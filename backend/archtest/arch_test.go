package archtest_test

import (
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"
)

func TestCleanArchitecture_DomainLayer_HasNoExternalDependencies(t *testing.T) {
	backendRoot, err := filepath.Abs("..")
	if err != nil {
		t.Fatalf("failed to determine backend root: %v", err)
	}

	servicesDir := filepath.Join(backendRoot, "services")
	fset := token.NewFileSet()

	err = filepath.WalkDir(servicesDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // directory might not exist yet during early stages
		}
		if d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}

		// Normalize path
		normPath := filepath.ToSlash(path)
		if !strings.Contains(normPath, "/internal/domain/") {
			return nil
		}

		// Extract service name (e.g. training, body, identity)
		parts := strings.Split(normPath, "services/")
		var currentService string
		if len(parts) > 1 {
			currentService = strings.Split(parts[1], "/")[0]
		}

		node, err := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
		if err != nil {
			t.Errorf("failed to parse file %s: %v", path, err)
			return nil
		}

		for _, imp := range node.Imports {
			impPath := strings.Trim(imp.Path.Value, `"`)

			// 1. Check if it's an internal domain import within the same service
			allowedInternalPrefix := "github.com/neverpaidhealth/backend/services/" + currentService + "/internal/domain"
			if strings.HasPrefix(impPath, allowedInternalPrefix) {
				continue // Allowed intra-service domain subpackages (e.g. calc, measure, routine)
			}

			// 2. Allow uuid for entity identifiers
			if impPath == "github.com/google/uuid" {
				continue
			}

			// 3. Rule: Domain must not import web frameworks, DB drivers, external SDKs or outer layers
			forbiddenPrefixes := []string{
				"github.com/go-chi",
				"github.com/gin-gonic",
				"github.com/labstack",
				"github.com/jackc",
				"github.com/nats-io",
				"golang.org",
				"net/http",
				"database/sql",
				"github.com/neverpaidhealth/backend/pkg",
			}

			for _, forbidden := range forbiddenPrefixes {
				if strings.HasPrefix(impPath, forbidden) {
					t.Errorf("Clean Architecture violation in %s: domain must not import external package %q", path, impPath)
				}
			}

			// 4. Domain must not import outer layers (application, adapters, transport)
			if strings.Contains(impPath, "/internal/application") ||
				strings.Contains(impPath, "/internal/adapters") ||
				strings.Contains(impPath, "/internal/transport") {
				t.Errorf("Clean Architecture violation in %s: domain must not import outer layer %q", path, impPath)
			}
		}

		return nil
	})

	if err != nil {
		t.Fatalf("error walking services directory: %v", err)
	}
}

func TestCleanArchitecture_NoCrossServiceInternalImports(t *testing.T) {
	backendRoot, err := filepath.Abs("..")
	if err != nil {
		t.Fatalf("failed to determine backend root: %v", err)
	}

	servicesDir := filepath.Join(backendRoot, "services")
	fset := token.NewFileSet()

	err = filepath.WalkDir(servicesDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}

		normPath := filepath.ToSlash(path)

		node, err := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
		if err != nil {
			return nil
		}

		for _, imp := range node.Imports {
			impPath := strings.Trim(imp.Path.Value, `"`)
			if strings.Contains(impPath, "github.com/neverpaidhealth/backend/services/") && strings.Contains(impPath, "/internal") {
				// Extract importing service name and imported service name
				parts := strings.Split(normPath, "services/")
				if len(parts) > 1 {
					importingService := strings.Split(parts[1], "/")[0]
					if !strings.Contains(impPath, "services/"+importingService+"/") {
						t.Errorf("Cross-service internal import violation in %s: service %s must not import %s", path, importingService, impPath)
					}
				}
			}
		}

		return nil
	})

	if err != nil {
		t.Fatalf("error walking services directory: %v", err)
	}
}
