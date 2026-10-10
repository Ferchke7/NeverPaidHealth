package program_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/program"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewProgram_Success(t *testing.T) {
	now := time.Now()
	userID := uuid.New()
	exID := uuid.New()

	ex, err := program.NewProgramExercise(exID, "Bench Press", 0, 4, nil, nil)
	require.NoError(t, err)

	day, err := program.NewProgramDay(1, "Push Day", "Chest focus", []*program.ProgramExercise{ex})
	require.NoError(t, err)

	p, err := program.NewProgram(
		userID,
		"PPL Hypertrophy",
		"6-day split",
		program.SplitPPL,
		6,
		program.LevelAdvanced,
		true,
		"Coach Alex",
		[]*program.ProgramDay{day},
		now,
	)

	require.NoError(t, err)
	assert.NotNil(t, p)
	assert.Equal(t, "PPL Hypertrophy", p.Name())
	assert.Equal(t, program.SplitPPL, p.SplitType())
	assert.Equal(t, 6, p.DaysPerWeek())
	assert.Equal(t, program.LevelAdvanced, p.Level())
	assert.True(t, p.IsPublic())
	assert.Equal(t, "Coach Alex", p.AuthorName())
	assert.Len(t, p.Days(), 1)
	assert.False(t, p.IsSystem())
}

func TestNewProgram_ValidationErrors(t *testing.T) {
	now := time.Now()
	userID := uuid.New()

	_, err := program.NewProgram(
		userID,
		"",
		"desc",
		program.SplitCustom,
		3,
		program.LevelBeginner,
		false,
		"",
		nil,
		now,
	)
	assert.ErrorIs(t, err, program.ErrEmptyProgramName)

	_, err = program.NewProgram(
		userID,
		"Valid Name",
		"desc",
		program.SplitCustom,
		3,
		program.LevelBeginner,
		false,
		"",
		nil,
		now,
	)
	assert.ErrorIs(t, err, program.ErrProgramRequiresDays)
}

func TestUserProgram_AdvanceDay(t *testing.T) {
	now := time.Now()
	userID := uuid.New()
	progID := uuid.New()

	up := program.NewUserProgram(userID, progID, "My Active PPL", true, now)
	assert.True(t, up.IsActive())
	assert.Equal(t, 0, up.CurrentDayIndex())

	up.AdvanceDay(3)
	assert.Equal(t, 1, up.CurrentDayIndex())

	up.AdvanceDay(3)
	assert.Equal(t, 2, up.CurrentDayIndex())

	up.AdvanceDay(3) // wrap around
	assert.Equal(t, 0, up.CurrentDayIndex())
}

func TestSplitTypes_AndLevels(t *testing.T) {
	splits := []program.SplitType{
		program.SplitPPL,
		program.SplitUpperLower,
		program.SplitFullBody,
		program.SplitBroSplit,
		program.SplitStrength,
		program.SplitCustom,
	}
	for _, s := range splits {
		assert.NotEmpty(t, string(s))
	}

	levels := []program.Level{
		program.LevelBeginner,
		program.LevelIntermediate,
		program.LevelAdvanced,
	}
	for _, l := range levels {
		assert.NotEmpty(t, string(l))
	}
}
