package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/neverpaidhealth/backend/pkg/httpx"
	"github.com/neverpaidhealth/backend/services/training/internal/adapters/postgres"
	"github.com/neverpaidhealth/backend/services/training/internal/application/command"
	"github.com/neverpaidhealth/backend/services/training/internal/application/query"
)

type Handler struct {
	startWorkoutCmd     *command.StartWorkoutHandler
	addExerciseCmd      *command.AddExerciseHandler
	logSetCmd           *command.LogSetHandler
	updateSetCmd        *command.UpdateSetHandler
	finishWorkoutCmd    *command.FinishWorkoutHandler
	createRoutineCmd    *command.CreateRoutineHandler
	deleteRoutineCmd    *command.DeleteRoutineHandler
	deleteWorkoutCmd    *command.DeleteWorkoutHandler
	createProgramCmd    *command.CreateProgramHandler
	publishProgramCmd   *command.PublishProgramHandler
	installProgramCmd   *command.InstallProgramHandler
	setActiveProgramCmd *command.SetActiveProgramHandler
	deleteProgramCmd    *command.DeleteProgramHandler
	queries             *query.TrainingQueriesHandler
	programQueries      *query.ProgramQueriesHandler
	communityRepo       *postgres.CommunityRepository
}

func NewHandler(
	startWorkout *command.StartWorkoutHandler,
	addExercise *command.AddExerciseHandler,
	logSet *command.LogSetHandler,
	updateSet *command.UpdateSetHandler,
	finishWorkout *command.FinishWorkoutHandler,
	createRoutine *command.CreateRoutineHandler,
	deleteRoutine *command.DeleteRoutineHandler,
	deleteWorkout *command.DeleteWorkoutHandler,
	createProgram *command.CreateProgramHandler,
	publishProgram *command.PublishProgramHandler,
	installProgram *command.InstallProgramHandler,
	setActiveProgram *command.SetActiveProgramHandler,
	deleteProgram *command.DeleteProgramHandler,
	queries *query.TrainingQueriesHandler,
	programQueries *query.ProgramQueriesHandler,
	communityRepo *postgres.CommunityRepository,
) *Handler {
	return &Handler{
		startWorkoutCmd:     startWorkout,
		addExerciseCmd:      addExercise,
		logSetCmd:           logSet,
		updateSetCmd:        updateSet,
		finishWorkoutCmd:    finishWorkout,
		createRoutineCmd:    createRoutine,
		deleteRoutineCmd:    deleteRoutine,
		deleteWorkoutCmd:    deleteWorkout,
		createProgramCmd:    createProgram,
		publishProgramCmd:   publishProgram,
		installProgramCmd:   installProgram,
		setActiveProgramCmd: setActiveProgram,
		deleteProgramCmd:    deleteProgram,
		queries:             queries,
		programQueries:      programQueries,
		communityRepo:       communityRepo,
	}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	r.Use(httpx.ExtractUserHeaderMiddleware)

	// Programs & Multi-Day Splits
	r.Get("/programs", httpx.RequireAuth(h.handleListPrograms))
	r.Post("/programs", httpx.RequireAuth(h.handleCreateProgram))
	r.Get("/programs/user/active", httpx.RequireAuth(h.handleGetActiveProgram))
	r.Post("/programs/user/active", httpx.RequireAuth(h.handleSetActiveProgram))
	r.Get("/programs/user/installed", httpx.RequireAuth(h.handleListInstalledPrograms))
	r.Get("/programs/{id}", httpx.RequireAuth(h.handleGetProgramByID))
	r.Put("/programs/{id}", httpx.RequireAuth(h.handleUpdateProgram))
	r.Delete("/programs/{id}", httpx.RequireAuth(h.handleDeleteProgram))
	r.Post("/programs/{id}/publish", httpx.RequireAuth(h.handlePublishProgram))
	r.Post("/programs/{id}/install", httpx.RequireAuth(h.handleInstallProgram))

	// Program Reviews & Ratings
	r.Get("/programs/{id}/reviews", httpx.RequireAuth(h.handleListProgramReviews))
	r.Post("/programs/{id}/reviews", httpx.RequireAuth(h.handleSaveProgramReview))
	r.Delete("/programs/{id}/reviews/{reviewId}", httpx.RequireAuth(h.handleDeleteProgramReview))

	// Feedback & Bug Reports
	r.Get("/feedback", httpx.RequireAuth(h.handleListFeedback))
	r.Post("/feedback", httpx.RequireAuth(h.handleCreateFeedback))
	r.Post("/feedback/{id}/upvote", httpx.RequireAuth(h.handleToggleFeedbackUpvote))
	r.Delete("/feedback/{id}", httpx.RequireAuth(h.handleDeleteFeedback))

	// Platform & Users Statistics
	r.Get("/platform/stats", httpx.RequireAuth(h.handleGetPlatformStats))

	// Routines
	r.Get("/routines", httpx.RequireAuth(h.handleListRoutines))
	r.Post("/routines", httpx.RequireAuth(h.handleCreateRoutine))
	r.Get("/routines/{id}", httpx.RequireAuth(h.handleGetRoutineByID))
	r.Delete("/routines/{id}", httpx.RequireAuth(h.handleDeleteRoutine))

	// Workouts
	r.Get("/workouts", httpx.RequireAuth(h.handleListWorkouts))
	r.Post("/workouts", httpx.RequireAuth(h.handleStartWorkout))
	r.Get("/workouts/active", httpx.RequireAuth(h.handleGetActiveWorkout))
	r.Get("/workouts/previous", httpx.RequireAuth(h.handleGetPreviousSets))
	r.Get("/workouts/{id}", httpx.RequireAuth(h.handleGetWorkoutByID))
	r.Delete("/workouts/{id}", httpx.RequireAuth(h.handleCancelWorkout))
	r.Post("/workouts/{id}/cancel", httpx.RequireAuth(h.handleCancelWorkout))
	r.Post("/workouts/{id}/finish", httpx.RequireAuth(h.handleFinishWorkout))
	r.Post("/workouts/{id}/exercises", httpx.RequireAuth(h.handleAddExercise))
	r.Post("/workouts/{id}/exercises/{exerciseId}/sets", httpx.RequireAuth(h.handleLogSet))
	r.Put("/workouts/{id}/sets/{setId}", httpx.RequireAuth(h.handleUpdateSet))

	return r
}
