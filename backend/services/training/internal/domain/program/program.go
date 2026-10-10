package program

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

type SplitType string

const (
	SplitPPL        SplitType = "ppl"
	SplitUpperLower SplitType = "upper_lower"
	SplitFullBody   SplitType = "full_body"
	SplitBroSplit   SplitType = "bro_split"
	SplitStrength   SplitType = "strength"
	SplitCustom     SplitType = "custom"
)

type Level string

const (
	LevelBeginner     Level = "beginner"
	LevelIntermediate Level = "intermediate"
	LevelAdvanced     Level = "advanced"
)

type Program struct {
	id            uuid.UUID
	userID        uuid.UUID
	name          string
	description   string
	splitType     SplitType
	daysPerWeek   int
	level         Level
	isPublic      bool
	authorName    string
	likesCount    int
	installsCount int
	days          []*ProgramDay
	createdAt     time.Time
	updatedAt     time.Time
}

func NewProgram(
	userID uuid.UUID,
	name string,
	description string,
	splitType SplitType,
	daysPerWeek int,
	level Level,
	isPublic bool,
	authorName string,
	days []*ProgramDay,
	now time.Time,
) (*Program, error) {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return nil, ErrEmptyProgramName
	}
	if len(days) == 0 {
		return nil, ErrProgramRequiresDays
	}

	if daysPerWeek <= 0 {
		daysPerWeek = len(days)
	}
	if splitType == "" {
		splitType = SplitCustom
	}
	if level == "" {
		level = LevelIntermediate
	}

	return &Program{
		id:            uuid.New(),
		userID:        userID,
		name:          trimmedName,
		description:   strings.TrimSpace(description),
		splitType:     splitType,
		daysPerWeek:   daysPerWeek,
		level:         level,
		isPublic:      isPublic,
		authorName:    strings.TrimSpace(authorName),
		likesCount:    0,
		installsCount: 0,
		days:          days,
		createdAt:     now,
		updatedAt:     now,
	}, nil
}

func Reconstitute(
	id uuid.UUID,
	userID uuid.UUID,
	name string,
	description string,
	splitType SplitType,
	daysPerWeek int,
	level Level,
	isPublic bool,
	authorName string,
	likesCount int,
	installsCount int,
	days []*ProgramDay,
	createdAt time.Time,
	updatedAt time.Time,
) *Program {
	return &Program{
		id:            id,
		userID:        userID,
		name:          name,
		description:   description,
		splitType:     splitType,
		daysPerWeek:   daysPerWeek,
		level:         level,
		isPublic:      isPublic,
		authorName:    authorName,
		likesCount:    likesCount,
		installsCount: installsCount,
		days:          days,
		createdAt:     createdAt,
		updatedAt:     updatedAt,
	}
}

func (p *Program) ID() uuid.UUID             { return p.id }
func (p *Program) UserID() uuid.UUID         { return p.userID }
func (p *Program) Name() string              { return p.name }
func (p *Program) Description() string       { return p.description }
func (p *Program) SplitType() SplitType      { return p.splitType }
func (p *Program) DaysPerWeek() int          { return p.daysPerWeek }
func (p *Program) Level() Level              { return p.level }
func (p *Program) IsPublic() bool            { return p.isPublic }
func (p *Program) AuthorName() string        { return p.authorName }
func (p *Program) LikesCount() int           { return p.likesCount }
func (p *Program) InstallsCount() int        { return p.installsCount }
func (p *Program) Days() []*ProgramDay       { return p.days }
func (p *Program) CreatedAt() time.Time      { return p.createdAt }
func (p *Program) UpdatedAt() time.Time      { return p.updatedAt }

func (p *Program) IsSystem() bool {
	return p.userID == uuid.Nil
}

func (p *Program) Update(
	name string,
	description string,
	splitType SplitType,
	daysPerWeek int,
	level Level,
	isPublic bool,
	authorName string,
	days []*ProgramDay,
	now time.Time,
) error {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return ErrEmptyProgramName
	}
	if len(days) == 0 {
		return ErrProgramRequiresDays
	}

	p.name = trimmedName
	p.description = strings.TrimSpace(description)
	p.splitType = splitType
	if daysPerWeek > 0 {
		p.daysPerWeek = daysPerWeek
	} else {
		p.daysPerWeek = len(days)
	}
	p.level = level
	p.isPublic = isPublic
	if authorName != "" {
		p.authorName = strings.TrimSpace(authorName)
	}
	p.days = days
	p.updatedAt = now
	return nil
}

func (p *Program) SetPublic(isPublic bool, now time.Time) {
	p.isPublic = isPublic
	p.updatedAt = now
}

func (p *Program) IncrementInstalls() {
	p.installsCount++
}

func (p *Program) IncrementLikes() {
	p.likesCount++
}
