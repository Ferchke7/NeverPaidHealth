package measure

type Reps struct {
	value int
}

func NewReps(val int) (Reps, error) {
	if val < 1 || val > 200 {
		return Reps{}, ErrRepsOutOfRange
	}
	return Reps{value: val}, nil
}

func (r Reps) Value() int {
	return r.value
}
