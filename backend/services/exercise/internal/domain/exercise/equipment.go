package exercise

import "strings"

type Equipment string

const (
	EquipBarbell      Equipment = "barbell"
	EquipDumbbell     Equipment = "dumbbell"
	EquipMachine      Equipment = "machine"
	EquipCable        Equipment = "cable"
	EquipBodyweight   Equipment = "bodyweight"
	EquipKettlebell   Equipment = "kettlebell"
	EquipSmithMachine Equipment = "smith_machine"
)

var validEquipment = map[Equipment]bool{
	EquipBarbell: true, EquipDumbbell: true, EquipMachine: true,
	EquipCable: true, EquipBodyweight: true, EquipKettlebell: true,
	EquipSmithMachine: true,
}

func NewEquipment(val string) (Equipment, error) {
	eq := Equipment(strings.ToLower(strings.TrimSpace(val)))
	if !validEquipment[eq] {
		return "", ErrInvalidEquipment
	}
	return eq, nil
}

func (e Equipment) String() string {
	return string(e)
}
