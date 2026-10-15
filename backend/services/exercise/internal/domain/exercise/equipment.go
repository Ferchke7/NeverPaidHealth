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
	EquipBands        Equipment = "bands"
	EquipEZBar        Equipment = "ez_bar"
	EquipExerciseBall Equipment = "exercise_ball"
	EquipMedicineBall Equipment = "medicine_ball"
	EquipFoamRoller   Equipment = "foam_roller"
	EquipOther        Equipment = "other"
)

var validEquipment = map[Equipment]bool{
	EquipBarbell: true, EquipDumbbell: true, EquipMachine: true,
	EquipCable: true, EquipBodyweight: true, EquipKettlebell: true,
	EquipSmithMachine: true, EquipBands: true, EquipEZBar: true,
	EquipExerciseBall: true, EquipMedicineBall: true, EquipFoamRoller: true,
	EquipOther: true,
}

func NewEquipment(val string) (Equipment, error) {
	norm := strings.ToLower(strings.TrimSpace(val))
	norm = strings.ReplaceAll(norm, "-", "_")
	norm = strings.ReplaceAll(norm, " ", "_")
	switch norm {
	case "body_only", "bodyweight", "none":
		return EquipBodyweight, nil
	case "e_z_curl_bar", "ez_curl_bar", "ez_bar", "curl_bar":
		return EquipEZBar, nil
	case "foam_roll", "foam_roller":
		return EquipFoamRoller, nil
	case "exercise_ball", "swiss_ball":
		return EquipExerciseBall, nil
	case "medicine_ball":
		return EquipMedicineBall, nil
	case "kettlebells":
		return EquipKettlebell, nil
	case "band", "bands", "resistance_band", "resistance_bands":
		return EquipBands, nil
	}
	eq := Equipment(norm)
	if !validEquipment[eq] {
		// Fallback to other if unrecognized
		return EquipOther, nil
	}
	return eq, nil
}

func (e Equipment) String() string {
	return string(e)
}
