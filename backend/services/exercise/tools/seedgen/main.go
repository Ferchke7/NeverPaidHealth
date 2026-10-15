package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/exercise/internal/domain/exercise"
)

var exerciseNamespace = uuid.MustParse("e59178bf-53df-4c3e-8664-d2e5a0134bc2")

type DBExercise struct {
	ID   string   `json:"id"`
	Name string   `json:"name"`
	P    []string `json:"p"`
	S    []string `json:"s"`
	Eq   string   `json:"eq"`
	Inst []string `json:"inst"`
}

func main() {
	rootDir, err := findRepoRoot()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error locating root: %v\n", err)
		os.Exit(1)
	}

	imagesTSPath := filepath.Join(rootDir, "frontend", "src", "shared", "lib", "exerciseImages.ts")
	tsBytes, err := os.ReadFile(imagesTSPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading %s: %v\n", imagesTSPath, err)
		os.Exit(1)
	}

	content := string(tsBytes)
	startMarker := "export const EXERCISE_DATABASE"
	startIdx := strings.Index(content, startMarker)
	if startIdx == -1 {
		fmt.Fprintf(os.Stderr, "Marker not found\n")
		os.Exit(1)
	}

	eqIdx := strings.Index(content[startIdx:], "=")
	braceStart := startIdx + eqIdx + strings.Index(content[startIdx+eqIdx:], "{")

	endMarker := "export const EXERCISE_ALIASES"
	markerPos := strings.Index(content, endMarker)
	lastBrace := strings.LastIndex(content[:markerPos], "}")

	rawJSON := content[braceStart : lastBrace+1]

	var dbExercises map[string]DBExercise
	if err := json.Unmarshal([]byte(rawJSON), &dbExercises); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing JSON: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Loaded %d exercises from exerciseImages.ts\n", len(dbExercises))

	// Load existing 78 exercise IDs and names from 000002 & 000003
	existingExercises := loadExistingExercises(rootDir)
	fmt.Printf("Loaded %d existing canonical exercises from migrations 000002 & 000003\n", len(existingExercises))

	// Generate SQL
	var b strings.Builder
	b.WriteString("-- Migration 000005: Import comprehensive free-exercise-db (800+ movements)\n")
	b.WriteString("-- Preserves all existing canonical exercise IDs while updating instructions & source IDs.\n\n")

	// Update existing 78 exercises first with source_id and instructions if matched
	b.WriteString("-- 1. Update existing canonical exercises with source_id and instructions\n")
	updatedCanonicalCount := 0
	for _, exist := range existingExercises {
		normExist := normalizeName(exist.Name)
		var matched *DBExercise
		for _, dbEx := range dbExercises {
			if normalizeName(dbEx.Name) == normExist || dbEx.ID == exist.Name || normalizeName(dbEx.ID) == normExist {
				matched = &dbEx
				break
			}
		}

		if matched != nil {
			instSQL := formatTextArray(matched.Inst)
			sourceMusclesSQL := formatTextArray(matched.P)
			b.WriteString(fmt.Sprintf(
				"UPDATE exercises SET source_id = '%s', instructions = %s, source_muscles = %s WHERE id = '%s';\n",
				escapeSQL(matched.ID),
				instSQL,
				sourceMusclesSQL,
				exist.ID,
			))
			updatedCanonicalCount++
		}
	}
	fmt.Printf("Matched and updated %d canonical exercises with rich metadata\n", updatedCanonicalCount)

	b.WriteString("\n-- 2. Insert all extended library movements with deterministic UUIDv5\n")
	b.WriteString("INSERT INTO exercises (\n")
	b.WriteString("    id, name, primary_muscle_group, secondary_muscle_groups, equipment,\n")
	b.WriteString("    measurement_type, is_custom, created_by_user_id, source_id, category, level, instructions, source_muscles\n")
	b.WriteString(") VALUES\n")

	var rows []string
	insertedCount := 0

	for _, dbEx := range dbExercises {
		// Skip if already in existing canonical
		isCanonical := false
		for _, exist := range existingExercises {
			if normalizeName(exist.Name) == normalizeName(dbEx.Name) {
				isCanonical = true
				break
			}
		}
		if isCanonical {
			continue
		}

		// Generate stable deterministic UUID
		deterministicUUID := uuid.NewSHA1(exerciseNamespace, []byte("exercise:"+dbEx.ID))

		// Muscle group
		primary := "full_body"
		if len(dbEx.P) > 0 {
			if mg, err := exercise.NewMuscleGroup(dbEx.P[0]); err == nil {
				primary = mg.String()
			}
		}

		var secondaries []string
		for _, s := range dbEx.S {
			if mg, err := exercise.NewMuscleGroup(s); err == nil {
				secondaries = append(secondaries, mg.String())
			}
		}

		// Equipment
		equip := "other"
		if eq, err := exercise.NewEquipment(dbEx.Eq); err == nil {
			equip = eq.String()
		}

		// Measurement type
		measurement := inferMeasurementType(dbEx.Name, equip)

		category := "strength"
		if primary == "cardio" || strings.Contains(strings.ToLower(dbEx.Name), "run") || strings.Contains(strings.ToLower(dbEx.Name), "cycle") {
			category = "cardio"
		} else if strings.Contains(strings.ToLower(dbEx.Name), "stretch") {
			category = "stretching"
		}

		row := fmt.Sprintf(
			"('%s', '%s', '%s', %s, '%s', '%s', false, NULL, '%s', '%s', 'intermediate', %s, %s)",
			deterministicUUID.String(),
			escapeSQL(dbEx.Name),
			primary,
			formatTextArray(secondaries),
			equip,
			measurement,
			escapeSQL(dbEx.ID),
			category,
			formatTextArray(dbEx.Inst),
			formatTextArray(dbEx.P),
		)
		rows = append(rows, row)
		insertedCount++
	}

	b.WriteString(strings.Join(rows, ",\n"))
	b.WriteString("\nON CONFLICT (id) DO UPDATE SET\n")
	b.WriteString("    name = EXCLUDED.name,\n")
	b.WriteString("    primary_muscle_group = EXCLUDED.primary_muscle_group,\n")
	b.WriteString("    secondary_muscle_groups = EXCLUDED.secondary_muscle_groups,\n")
	b.WriteString("    equipment = EXCLUDED.equipment,\n")
	b.WriteString("    measurement_type = EXCLUDED.measurement_type,\n")
	b.WriteString("    source_id = EXCLUDED.source_id,\n")
	b.WriteString("    category = EXCLUDED.category,\n")
	b.WriteString("    instructions = EXCLUDED.instructions,\n")
	b.WriteString("    source_muscles = EXCLUDED.source_muscles;\n")

	migrationPath := filepath.Join(rootDir, "backend", "services", "exercise", "migrations", "000005_import_free_exercise_db.up.sql")
	if err := os.WriteFile(migrationPath, []byte(b.String()), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing migration: %v\n", err)
		os.Exit(1)
	}

	downSQL := "-- Revert migration 000005\nDELETE FROM exercises WHERE source_id IS NOT NULL AND id NOT IN (\n    SELECT id FROM exercises WHERE is_custom = TRUE\n);\n"
	downPath := filepath.Join(rootDir, "backend", "services", "exercise", "migrations", "000005_import_free_exercise_db.down.sql")
	_ = os.WriteFile(downPath, []byte(downSQL), 0644)

	fmt.Printf("Successfully generated migration 000005 with %d new exercises + %d canonical updates!\n", insertedCount, updatedCanonicalCount)
}

type CanonicalEx struct {
	ID   string
	Name string
}

func loadExistingExercises(rootDir string) []CanonicalEx {
	var list []CanonicalEx
	m2 := filepath.Join(rootDir, "backend", "services", "exercise", "migrations", "000002_seed_exercises.up.sql")
	m3 := filepath.Join(rootDir, "backend", "services", "exercise", "migrations", "000003_more_seed_exercises.up.sql")

	re := regexp.MustCompile(`\('([0-9a-fA-F\-]{36})',\s*'([^']+)'`)

	for _, p := range []string{m2, m3} {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		matches := re.FindAllStringSubmatch(string(data), -1)
		for _, m := range matches {
			list = append(list, CanonicalEx{
				ID:   m[1],
				Name: m[2],
			})
		}
	}
	return list
}

func inferMeasurementType(name, equipment string) string {
	lower := strings.ToLower(name)
	if equipment == "bodyweight" {
		if strings.Contains(lower, "plank") ||
			strings.Contains(lower, "hold") ||
			strings.Contains(lower, "stretch") ||
			strings.Contains(lower, "wall sit") ||
			strings.Contains(lower, "hang") ||
			strings.Contains(lower, "bridge") && !strings.Contains(lower, "press") {
			return "duration"
		}
		if strings.Contains(lower, "run") ||
			strings.Contains(lower, "jog") ||
			strings.Contains(lower, "walk") ||
			strings.Contains(lower, "cycle") ||
			strings.Contains(lower, "sprint") {
			return "distance_duration"
		}
		return "bodyweight_reps"
	}
	if equipment == "foam_roller" {
		return "duration"
	}
	return "weight_reps"
}

func normalizeName(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, "-", " ")
	s = strings.ReplaceAll(s, "_", " ")
	s = strings.ReplaceAll(s, "(", " ")
	s = strings.ReplaceAll(s, ")", " ")
	return strings.Join(strings.Fields(s), " ")
}

func escapeSQL(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}

func formatTextArray(items []string) string {
	if len(items) == 0 {
		return "'{}'"
	}
	escaped := make([]string, 0, len(items))
	for _, item := range items {
		escapedItem := strings.ReplaceAll(item, `"`, `\"`)
		escapedItem = strings.ReplaceAll(escapedItem, `'`, `''`)
		escaped = append(escaped, `"`+escapedItem+`"`)
	}
	return fmt.Sprintf("'{%s}'", strings.Join(escaped, ", "))
}

func findRepoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "frontend")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ".", nil
}
