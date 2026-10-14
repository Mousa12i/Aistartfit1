const fs = require('fs');
const data = require('../data/free-exercise-db.json');

const muscleMap = {
  'chest': 'chest', 'shoulders': 'shoulders', 'traps': 'shoulders', 'neck': 'shoulders',
  'biceps': 'arms', 'triceps': 'arms', 'forearms': 'arms',
  'lats': 'back', 'middle back': 'back', 'lower back': 'back',
  'abdominals': 'core', 'abductors': 'legs', 'adductors': 'legs',
  'quadriceps': 'legs', 'hamstrings': 'legs', 'calves': 'legs', 'glutes': 'glutes',
};

const equipMap = {
  'body only': 'none', 'barbell': 'barbell', 'dumbbell': 'dumbbells',
  'kettlebells': 'kettlebell', 'bands': 'resistance_bands', 'cable': 'machine',
  'machine': 'machine', 'e-z curl bar': 'barbell', 'exercise ball': 'bench',
  'foam roll': 'other', 'medicine ball': 'other', 'other': 'other',
};

const levelMap = { 'beginner': 'beginner', 'intermediate': 'intermediate', 'expert': 'advanced' };
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

function esc(s) { return String(s || '').replace(/'/g, "''"); }

const values = data.map(e => {
  const primaryMusclesRaw = e.primaryMuscles || [];
  const secondaryMusclesRaw = e.secondaryMuscles || [];
  const primaryMuscles = primaryMusclesRaw.map(m => muscleMap[m] || 'full_body');
  const primaryMuscle = primaryMuscles[0] || 'full_body';
  const secondaryMuscles = secondaryMusclesRaw.map(m => muscleMap[m] || 'full_body').filter(m => m !== primaryMuscle);
  const equipment = equipMap[e.equipment] || 'other';
  const difficulty = levelMap[e.level] || 'beginner';
  const instructions = (e.instructions || []).map(esc);
  const imageUrl = e.images && e.images.length > 0 ? IMAGE_BASE + e.images[0] : null;
  const desc = instructions[0] ? instructions[0].slice(0, 200) : e.name;
  const category = esc(e.category || 'strength');
  const force = e.force ? esc(e.force) : null;
  const mechanic = e.mechanic ? esc(e.mechanic) : null;
  const sourceId = esc(e.id);
  const name = esc(e.name);

  const instrArr = "ARRAY['" + instructions.join("','") + "']::text[]";
  const secArr = secondaryMuscles.length > 0 ? "ARRAY['" + secondaryMuscles.join("','") + "']::text[]" : "ARRAY[]::text[]";
  const pmRawArr = "ARRAY['" + primaryMusclesRaw.map(esc).join("','") + "']::text[]";
  const smRawArr = secondaryMusclesRaw.length > 0 ? "ARRAY['" + secondaryMusclesRaw.map(esc).join("','") + "']::text[]" : "ARRAY[]::text[]";

  return `('${sourceId}','${name}','${desc}',${instrArr},'${primaryMuscle}',${secArr},'${equipment}','${difficulty}','${category}',${force ? "'" + force + "'" : 'NULL'},${mechanic ? "'" + mechanic + "'" : 'NULL'},${pmRawArr},${smRawArr},${imageUrl ? "'" + imageUrl + "'" : 'NULL'})`;
});

fs.writeFileSync('/tmp/seed_values.sql', values.join(',\n'));
console.log('Generated ' + values.length + ' values');
console.log('File size: ' + fs.statSync('/tmp/seed_values.sql').size + ' bytes');
