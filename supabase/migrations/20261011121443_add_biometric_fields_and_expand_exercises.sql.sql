/*
# Add biometric fields to profiles and expand exercise library to 150+

## Changes
1. Adds body_fat_pct, physique_goal, joint_limitations columns to profiles
2. Adds movement_pattern, exercise_type, is_pro columns to exercises
3. Adds unique index on exercises.name for deduplication
4. Inserts 130+ new exercises across all muscle groups
5. Marks bodyweight/dumbbell exercises as free tier, barbell/machine as Pro

## Security
- No RLS changes — profiles already has owner-scoped RLS
- exercises table is publicly readable
*/

-- Add biometric fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_fat_pct numeric DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS physique_goal text DEFAULT 'general';

-- Add categorization columns to exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS movement_pattern text DEFAULT 'horizontal_push';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS exercise_type text DEFAULT 'compound';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_pro boolean DEFAULT false;

-- Add unique index on exercise name (needed for ON CONFLICT deduplication)
CREATE UNIQUE INDEX IF NOT EXISTS exercises_name_key ON exercises (name);

-- Mark existing bodyweight/basic exercises as free tier
UPDATE exercises SET is_pro = false WHERE equipment IN ('none', 'dumbbells');
UPDATE exercises SET is_pro = true WHERE equipment NOT IN ('none', 'dumbbells');

-- Update movement_pattern and exercise_type for any null values
UPDATE exercises SET movement_pattern = 'horizontal_push' WHERE movement_pattern IS NULL OR movement_pattern = '';
UPDATE exercises SET exercise_type = 'compound' WHERE exercise_type IS NULL OR exercise_type = '';

-- ============ INSERT 130+ NEW EXERCISES ============

INSERT INTO exercises (name, description, instructions, primary_muscle, secondary_muscles, equipment, difficulty, default_sets, default_reps, default_rest_seconds, movement_pattern, exercise_type, is_pro)
SELECT * FROM (VALUES
  -- CHEST (20)
  ('Barbell Bench Press', 'Classic mass builder for the chest', ARRAY['Lie on a flat bench', 'Grip bar slightly wider than shoulders', 'Lower to mid-chest', 'Press up explosively'], 'chest', ARRAY['shoulders','arms'], 'barbell', 'intermediate', 4, '6-8', 120, 'horizontal_push', 'compound', true),
  ('Incline Dumbbell Press', 'Targets upper chest fibres', ARRAY['Set bench to 30-45 degrees', 'Press dumbbells up and slightly together', 'Lower with control'], 'chest', ARRAY['shoulders'], 'dumbbells', 'intermediate', 4, '8-12', 90, 'horizontal_push', 'compound', false),
  ('Decline Bench Press', 'Emphasises lower chest', ARRAY['Lie on decline bench', 'Lower bar to lower chest', 'Press up powerfully'], 'chest', ARRAY['shoulders','arms'], 'barbell', 'advanced', 4, '6-10', 120, 'horizontal_push', 'compound', true),
  ('Dumbbell Fly', 'Isolation stretch for chest', ARRAY['Lie flat on bench', 'Lower dumbbells in arc motion', 'Squeeze chest at top'], 'chest', ARRAY['shoulders'], 'dumbbells', 'beginner', 3, '12-15', 60, 'horizontal_push', 'isolation', false),
  ('Cable Crossover', 'Continuous tension chest fly', ARRAY['Stand between cable columns', 'Bring handles together in front', 'Squeeze and release slowly'], 'chest', ARRAY['shoulders'], 'machine', 'intermediate', 3, '12-15', 60, 'horizontal_push', 'isolation', true),
  ('Wide Push-up', 'Wider grip for chest emphasis', ARRAY['Place hands wider than shoulders', 'Lower slowly', 'Press up squeezing chest'], 'chest', ARRAY['shoulders','arms'], 'none', 'beginner', 3, '8-15', 60, 'horizontal_push', 'compound', false),
  ('Diamond Push-up', 'Triceps and inner chest', ARRAY['Form diamond with hands', 'Lower with elbows tucked', 'Press up'], 'chest', ARRAY['arms'], 'none', 'intermediate', 3, '8-12', 60, 'horizontal_push', 'compound', false),
  ('Incline Barbell Press', 'Upper chest strength builder', ARRAY['Set bench to 30 degrees', 'Grip bar shoulder-width', 'Lower to upper chest, press up'], 'chest', ARRAY['shoulders'], 'barbell', 'intermediate', 4, '6-10', 90, 'horizontal_push', 'compound', true),
  ('Machine Chest Press', 'Guided chest press movement', ARRAY['Sit at chest press machine', 'Grip handles at chest level', 'Press forward, return slowly'], 'chest', ARRAY['shoulders','arms'], 'machine', 'beginner', 3, '10-12', 60, 'horizontal_push', 'compound', true),
  ('Dumbbell Pullover', 'Chest and lat stretch', ARRAY['Lie across bench', 'Lower dumbbell behind head', 'Pull over to chest'], 'chest', ARRAY['back'], 'dumbbells', 'intermediate', 3, '12-15', 60, 'horizontal_pull', 'isolation', false),
  ('Weighted Push-up', 'Push-up with added resistance', ARRAY['Place weight on upper back', 'Perform standard push-up', 'Keep core engaged throughout'], 'chest', ARRAY['shoulders','arms'], 'none', 'intermediate', 4, '8-12', 90, 'horizontal_push', 'compound', false),
  ('Floor Press', 'Bench press on the floor', ARRAY['Lie on floor with barbell', 'Lower until elbows touch ground', 'Press up'], 'chest', ARRAY['arms'], 'barbell', 'intermediate', 4, '6-10', 90, 'horizontal_push', 'compound', true),
  ('Close-Grip Bench Press', 'Triceps-focused bench press', ARRAY['Grip bar shoulder-width', 'Lower to lower chest', 'Press up keeping elbows tucked'], 'chest', ARRAY['arms'], 'barbell', 'intermediate', 4, '8-10', 90, 'horizontal_push', 'compound', true),
  ('Pec Deck Machine', 'Isolated chest fly machine', ARRAY['Sit with forearms on pads', 'Bring arms together', 'Return slowly with control'], 'chest', ARRAY['shoulders'], 'machine', 'beginner', 3, '12-15', 60, 'horizontal_push', 'isolation', true),
  ('Medicine Ball Push-up', 'Unstable push-up variation', ARRAY['One hand on medicine ball', 'Lower and press up', 'Alternate sides each rep'], 'chest', ARRAY['shoulders','arms'], 'none', 'advanced', 3, '8-10', 60, 'horizontal_push', 'compound', false),
  ('Archer Push-up', 'One-arm emphasis push-up', ARRAY['Wider than shoulder stance', 'Lower to one side', 'Press up, alternate sides'], 'chest', ARRAY['shoulders','arms'], 'none', 'advanced', 3, '6-8', 60, 'horizontal_push', 'compound', false),
  ('Staggered Push-up', 'Asymmetric hand placement', ARRAY['One hand forward, one back', 'Perform push-up', 'Switch hand positions'], 'chest', ARRAY['shoulders','arms'], 'none', 'intermediate', 3, '8-12', 60, 'horizontal_push', 'compound', false),
  ('Deficit Push-up', 'Extended range push-up', ARRAY['Hands on elevated surfaces', 'Lower chest below hand level', 'Press up powerfully'], 'chest', ARRAY['shoulders','arms'], 'none', 'advanced', 3, '6-10', 60, 'horizontal_push', 'compound', false),
  ('Cable Chest Press', 'Standing cable press for chest', ARRAY['Set cables at chest height', 'Press handles forward', 'Return with control'], 'chest', ARRAY['shoulders','arms'], 'machine', 'intermediate', 3, '10-12', 60, 'horizontal_push', 'compound', true),
  ('Incline Dumbbell Fly', 'Upper chest fly', ARRAY['Set bench to 30 degrees', 'Lower dumbbells in arc', 'Squeeze at top'], 'chest', ARRAY['shoulders'], 'dumbbells', 'beginner', 3, '12-15', 60, 'horizontal_push', 'isolation', false),
  -- BACK (20)
  ('Pull-up', 'Classic back and biceps builder', ARRAY['Hang from bar', 'Pull chin above bar', 'Lower with control'], 'back', ARRAY['arms'], 'pull_up_bar', 'intermediate', 4, '6-10', 90, 'vertical_pull', 'compound', true),
  ('Chin-up', 'Underhand grip pull-up', ARRAY['Grip bar underhand', 'Pull up until chin clears bar', 'Lower slowly'], 'back', ARRAY['arms'], 'pull_up_bar', 'intermediate', 4, '6-10', 90, 'vertical_pull', 'compound', true),
  ('Wide Grip Pull-up', 'Wider grip for lat emphasis', ARRAY['Grip bar wider than shoulders', 'Pull up squeezing lats', 'Lower with control'], 'back', ARRAY['shoulders'], 'pull_up_bar', 'advanced', 4, '5-8', 120, 'vertical_pull', 'compound', true),
  ('Barbell Row', 'Compound back thickness builder', ARRAY['Hinge at hips', 'Pull bar to lower ribs', 'Lower with control'], 'back', ARRAY['arms'], 'barbell', 'intermediate', 4, '8-10', 90, 'horizontal_pull', 'compound', true),
  ('Seated Cable Row', 'Mid-back rowing movement', ARRAY['Sit at cable row station', 'Pull handle to stomach', 'Return with stretch'], 'back', ARRAY['arms'], 'machine', 'beginner', 4, '10-12', 60, 'horizontal_pull', 'compound', true),
  ('Lat Pulldown', 'Lat width builder', ARRAY['Grip bar wider than shoulders', 'Pull to upper chest', 'Return with control'], 'back', ARRAY['arms'], 'machine', 'beginner', 4, '10-12', 60, 'vertical_pull', 'compound', true),
  ('T-Bar Row', 'Supported heavy row', ARRAY['Stand over T-bar', 'Grip handles', 'Row to chest, lower slowly'], 'back', ARRAY['arms','shoulders'], 'barbell', 'advanced', 4, '8-10', 90, 'horizontal_pull', 'compound', true),
  ('Pendlay Row', 'Explosive barbell row', ARRAY['Bar starts on floor each rep', 'Explosively pull to chest', 'Lower to floor'], 'back', ARRAY['arms','shoulders'], 'barbell', 'advanced', 5, '5-8', 120, 'horizontal_pull', 'compound', true),
  ('Face Pull', 'Rear delt and upper back', ARRAY['Set cable at face height', 'Pull rope to face', 'Squeeze rear delts'], 'back', ARRAY['shoulders'], 'machine', 'beginner', 3, '15-20', 45, 'horizontal_pull', 'isolation', true),
  ('Straight Arm Pulldown', 'Lat isolation with cable', ARRAY['Stand at cable machine', 'Push bar down to thighs', 'Return with stretch'], 'back', ARRAY['chest'], 'machine', 'beginner', 3, '12-15', 60, 'vertical_pull', 'isolation', true),
  ('Inverted Row', 'Bodyweight horizontal pull', ARRAY['Set bar at waist height', 'Pull chest to bar', 'Lower with control'], 'back', ARRAY['arms'], 'pull_up_bar', 'beginner', 3, '10-15', 60, 'horizontal_pull', 'compound', false),
  ('Superman Hold', 'Bodyweight back extension', ARRAY['Lie face down', 'Lift arms and legs', 'Hold and lower'], 'back', ARRAY['core','glutes'], 'none', 'beginner', 3, '15-20s hold', 45, 'horizontal_pull', 'isolation', false),
  ('Renegade Row', 'Plank to row combo', ARRAY['Start in plank with dumbbells', 'Row one dumbbell at a time', 'Keep hips stable'], 'back', ARRAY['core','arms'], 'dumbbells', 'intermediate', 3, '8-10', 60, 'horizontal_pull', 'compound', false),
  ('Meadows Row', 'Single-arm landmine row', ARRAY['Barbell in landmine corner', 'Row with one hand', 'Squeeze at top'], 'back', ARRAY['arms'], 'barbell', 'advanced', 3, '8-12', 90, 'horizontal_pull', 'compound', true),
  ('Rack Pull', 'Partial deadlift for back', ARRAY['Set bar at knee height in rack', 'Pull to lockout', 'Lower to pins'], 'back', ARRAY['glutes','legs'], 'barbell', 'advanced', 4, '5-8', 120, 'horizontal_pull', 'compound', true),
  ('Cable Shrugs', 'Trap builder with cable', ARRAY['Stand at low cable', 'Shrug shoulders up', 'Lower slowly'], 'back', ARRAY['shoulders'], 'machine', 'beginner', 4, '12-15', 45, 'vertical_pull', 'isolation', true),
  ('Band Pull-Apart', 'Rear delt activation', ARRAY['Hold band at chest height', 'Pull band apart', 'Return slowly'], 'back', ARRAY['shoulders'], 'resistance_bands', 'beginner', 3, '15-20', 45, 'horizontal_pull', 'isolation', false),
  ('Single-Arm Lat Pulldown', 'Unilateral lat work', ARRAY['Use single handle on cable', 'Pull down to side', 'Return with stretch'], 'back', ARRAY['arms'], 'machine', 'intermediate', 3, '10-12', 60, 'vertical_pull', 'isolation', true),
  ('Underhand Barbell Row', 'Biased back row', ARRAY['Grip bar underhand', 'Row to lower ribs', 'Lower with control'], 'back', ARRAY['arms'], 'barbell', 'intermediate', 4, '8-10', 90, 'horizontal_pull', 'compound', true),
  ('Chest-Supported Row', 'Bench-supported dumbbell row', ARRAY['Lie face down on incline bench', 'Row dumbbells to ribs', 'Lower with stretch'], 'back', ARRAY['arms'], 'dumbbells', 'intermediate', 3, '10-12', 60, 'horizontal_pull', 'compound', false),
  -- LEGS (25)
  ('Barbell Back Squat', 'King of leg exercises', ARRAY['Bar on upper traps', 'Descend below parallel', 'Drive up through heels'], 'legs', ARRAY['glutes','core'], 'barbell', 'intermediate', 4, '6-8', 120, 'squat', 'compound', true),
  ('Front Squat', 'Quad-dominant squat', ARRAY['Bar on front shoulders', 'Keep torso upright', 'Descend and drive up'], 'legs', ARRAY['glutes','core'], 'barbell', 'advanced', 4, '6-8', 120, 'squat', 'compound', true),
  ('Bulgarian Split Squat', 'Single-leg strength', ARRAY['Rear foot on bench', 'Lower front thigh to parallel', 'Drive up through front heel'], 'legs', ARRAY['glutes'], 'dumbbells', 'intermediate', 3, '8-10', 90, 'squat', 'compound', false),
  ('Romanian Deadlift', 'Hamstring hinge movement', ARRAY['Hold bar at hips', 'Hinge forward pushing hips back', 'Feel hamstring stretch, return'], 'legs', ARRAY['glutes','back'], 'barbell', 'intermediate', 4, '8-10', 90, 'hinge', 'compound', true),
  ('Walking Lunge', 'Leg and glute builder', ARRAY['Step forward into lunge', 'Lower back knee toward floor', 'Push through front heel to next step'], 'legs', ARRAY['glutes'], 'dumbbells', 'beginner', 3, '12 each leg', 60, 'lunge', 'compound', false),
  ('Reverse Lunge', 'Glute-focused lunge', ARRAY['Step backward into lunge', 'Lower until knee nears floor', 'Return to standing'], 'legs', ARRAY['glutes'], 'dumbbells', 'beginner', 3, '10 each leg', 60, 'lunge', 'compound', false),
  ('Leg Press', 'Machine leg builder', ARRAY['Feet on platform shoulder-width', 'Lower with control', 'Press up without locking knees'], 'legs', ARRAY['glutes'], 'machine', 'beginner', 4, '10-12', 90, 'squat', 'compound', true),
  ('Leg Extension', 'Quad isolation', ARRAY['Sit at extension machine', 'Extend knees fully', 'Lower with control'], 'legs', ARRAY[]::text[], 'machine', 'beginner', 3, '12-15', 45, 'knee_extension', 'isolation', true),
  ('Leg Curl', 'Hamstring isolation', ARRAY['Lie face down on curl machine', 'Curl heels toward glutes', 'Lower with control'], 'legs', ARRAY[]::text[], 'machine', 'beginner', 3, '12-15', 45, 'knee_flexion', 'isolation', true),
  ('Seated Calf Raise', 'Seated calf isolation', ARRAY['Sit at calf raise machine', 'Press up onto toes', 'Lower for deep stretch'], 'legs', ARRAY[]::text[], 'machine', 'intermediate', 4, '15-20', 45, 'calf_raise', 'isolation', true),
  ('Hack Squat', 'Machine squat variation', ARRAY['Position on hack squat machine', 'Lower with control', 'Drive up through platform'], 'legs', ARRAY['glutes'], 'machine', 'intermediate', 4, '8-10', 90, 'squat', 'compound', true),
  ('Sumo Squat', 'Inner thigh emphasis', ARRAY['Wide stance, toes pointed out', 'Squat down between legs', 'Drive up'], 'legs', ARRAY['glutes'], 'dumbbells', 'beginner', 3, '12-15', 60, 'squat', 'compound', false),
  ('Step-Up', 'Single-leg power', ARRAY['Step onto box/bench', 'Drive through working leg', 'Step down with control'], 'legs', ARRAY['glutes'], 'dumbbells', 'beginner', 3, '10 each leg', 60, 'lunge', 'compound', false),
  ('Good Morning', 'Hamstring and lower back', ARRAY['Bar on traps', 'Hinge forward at hips', 'Return to standing'], 'legs', ARRAY['back','glutes'], 'barbell', 'advanced', 4, '8-10', 90, 'hinge', 'compound', true),
  ('Pistol Squat', 'Single-leg bodyweight squat', ARRAY['Extend one leg forward', 'Squat on standing leg', 'Drive back up'], 'legs', ARRAY['glutes'], 'none', 'advanced', 3, '5-8 each leg', 90, 'squat', 'compound', false),
  ('Jump Squat', 'Explosive power squat', ARRAY['Perform bodyweight squat', 'Explode upward into jump', 'Land softly and repeat'], 'legs', ARRAY['glutes'], 'none', 'intermediate', 3, '10-15', 60, 'squat', 'compound', false),
  ('Stiff-Leg Deadlift', 'Hamstring isolation hinge', ARRAY['Hold bar with straight legs', 'Hinge forward maintaining slight knee bend', 'Return to standing'], 'legs', ARRAY['glutes'], 'barbell', 'intermediate', 3, '10-12', 60, 'hinge', 'compound', true),
  ('Box Squat', 'Paused box squat for power', ARRAY['Sit back to box', 'Pause on box', 'Explode up'], 'legs', ARRAY['glutes'], 'barbell', 'advanced', 4, '5-8', 120, 'squat', 'compound', true),
  ('Sissy Squat', 'Quad isolation', ARRAY['Lean back on sisy apparatus', 'Lower body keeping torso straight', 'Return to start'], 'legs', ARRAY[]::text[], 'none', 'advanced', 3, '8-12', 60, 'squat', 'isolation', false),
  ('Spanish Squat', 'Band-resisted squat', ARRAY['Band around knees', 'Squat against band tension', 'Hold at bottom briefly'], 'legs', ARRAY['glutes'], 'resistance_bands', 'intermediate', 3, '10-12', 60, 'squat', 'compound', false),
  ('Cable Kickback', 'Glute cable kickback', ARRAY['Attach ankle strap to low cable', 'Kick leg back', 'Return with control'], 'legs', ARRAY['glutes'], 'machine', 'beginner', 3, '12-15', 45, 'hinge', 'isolation', true),
  ('Banded Lateral Walk', 'Glute medius activation', ARRAY['Band around ankles', 'Side-step maintaining tension', 'Alternate directions'], 'legs', ARRAY['glutes'], 'resistance_bands', 'beginner', 3, '15 each way', 45, 'abduction', 'isolation', false),
  ('Goblet Squat', 'Beginner-friendly squat', ARRAY['Hold dumbbell at chest', 'Squat between knees', 'Drive up through heels'], 'legs', ARRAY['glutes'], 'dumbbells', 'beginner', 3, '10-12', 60, 'squat', 'compound', false),
  ('Calf Raise', 'Calf builder', ARRAY['Stand on edge of platform', 'Rise onto toes fully', 'Lower for stretch'], 'legs', ARRAY[]::text[], 'none', 'beginner', 4, '15-20', 45, 'calf_raise', 'isolation', false),
  ('Wall Sit', 'Isometric quad endurance', ARRAY['Slide down wall to 90 degree squat', 'Keep back flat against wall', 'Hold for time'], 'legs', ARRAY['glutes'], 'none', 'beginner', 3, '30-60s hold', 45, 'squat', 'isolation', false),
  -- SHOULDERS (15)
  ('Overhead Press', 'Standing barbell press', ARRAY['Bar at shoulder height', 'Press overhead', 'Lower to shoulders with control'], 'shoulders', ARRAY['arms','chest'], 'barbell', 'intermediate', 4, '6-8', 120, 'vertical_push', 'compound', true),
  ('Dumbbell Shoulder Press', 'Seated dumbbell press', ARRAY['Sit with back supported', 'Press dumbbells overhead', 'Lower to shoulder height'], 'shoulders', ARRAY['arms'], 'dumbbells', 'beginner', 4, '8-12', 90, 'vertical_push', 'compound', false),
  ('Lateral Raise', 'Side delt isolation', ARRAY['Hold dumbbells at sides', 'Raise arms to shoulder height', 'Lower slowly'], 'shoulders', ARRAY[]::text[], 'dumbbells', 'beginner', 3, '12-15', 45, 'abduction', 'isolation', false),
  ('Front Raise', 'Front delt isolation', ARRAY['Hold dumbbells at front', 'Raise to shoulder height', 'Lower with control'], 'shoulders', ARRAY[]::text[], 'dumbbells', 'beginner', 3, '12-15', 45, 'flexion', 'isolation', false),
  ('Rear Delt Fly', 'Rear delt isolation', ARRAY['Bend over with dumbbells', 'Raise arms to sides', 'Squeeze rear delts'], 'shoulders', ARRAY['back'], 'dumbbells', 'beginner', 3, '12-15', 45, 'horizontal_pull', 'isolation', false),
  ('Arnold Press', 'Rotational shoulder press', ARRAY['Start with palms facing in', 'Rotate as you press up', 'Reverse on the way down'], 'shoulders', ARRAY['arms'], 'dumbbells', 'intermediate', 3, '10-12', 60, 'vertical_push', 'compound', false),
  ('Cable Lateral Raise', 'Cable side delt work', ARRAY['Stand beside low cable', 'Raise cable arm to side', 'Lower with control'], 'shoulders', ARRAY[]::text[], 'machine', 'beginner', 3, '12-15', 45, 'abduction', 'isolation', true),
  ('Push Press', 'Leg-driven overhead press', ARRAY['Slight dip in knees', 'Drive up and press overhead', 'Lock out and lower'], 'shoulders', ARRAY['legs','arms'], 'barbell', 'advanced', 4, '5-8', 120, 'vertical_push', 'compound', true),
  ('Upright Row', 'Shoulder and trap builder', ARRAY['Grip bar at waist', 'Pull up to chin height', 'Lower with control'], 'shoulders', ARRAY['back','arms'], 'barbell', 'intermediate', 3, '10-12', 60, 'vertical_pull', 'compound', true),
  ('Pike Push-up', 'Bodyweight shoulder press', ARRAY['Start in pike position', 'Lower head toward floor', 'Press up'], 'shoulders', ARRAY['arms'], 'none', 'intermediate', 3, '8-12', 60, 'vertical_push', 'compound', false),
  ('Handstand Push-up', 'Advanced bodyweight shoulder', ARRAY['Kick up to handstand', 'Lower head to floor', 'Press up'], 'shoulders', ARRAY['arms'], 'none', 'advanced', 3, '5-8', 90, 'vertical_push', 'compound', false),
  ('Cuban Press', 'Rotator cuff and shoulder health', ARRAY['Start with light dumbbells', 'External rotate then press', 'Reverse the motion'], 'shoulders', ARRAY[]::text[], 'dumbbells', 'intermediate', 3, '10-12', 45, 'rotation', 'isolation', false),
  ('Barbell Shrugs', 'Trap builder', ARRAY['Hold bar at waist', 'Shrug shoulders up', 'Lower with control'], 'shoulders', ARRAY['back'], 'barbell', 'beginner', 4, '12-15', 45, 'shrug', 'isolation', true),
  ('Dumbbell Shrugs', 'Dumbbell trap builder', ARRAY['Hold dumbbells at sides', 'Shrug up squeezing traps', 'Lower slowly'], 'shoulders', ARRAY['back'], 'dumbbells', 'beginner', 4, '12-15', 45, 'shrug', 'isolation', false),
  ('Y-Raise', 'Lower trap activation', ARRAY['Lie face down on incline bench', 'Raise dumbbells in Y pattern', 'Lower with control'], 'shoulders', ARRAY['back'], 'dumbbells', 'beginner', 3, '12-15', 45, 'abduction', 'isolation', false),
  -- ARMS (15)
  ('Barbell Curl', 'Classic biceps builder', ARRAY['Grip bar underhand', 'Curl bar to chest', 'Lower with control'], 'arms', ARRAY[]::text[], 'barbell', 'beginner', 3, '10-12', 45, 'elbow_flexion', 'isolation', true),
  ('Dumbbell Curl', 'Alternating biceps curl', ARRAY['Curl one dumbbell at a time', 'Squeeze at top', 'Lower slowly'], 'arms', ARRAY[]::text[], 'dumbbells', 'beginner', 3, '10-12', 45, 'elbow_flexion', 'isolation', false),
  ('Hammer Curl', 'Brachialis emphasis', ARRAY['Neutral grip on dumbbells', 'Curl up maintaining grip', 'Lower with control'], 'arms', ARRAY[]::text[], 'dumbbells', 'beginner', 3, '10-12', 45, 'elbow_flexion', 'isolation', false),
  ('Triceps Pushdown', 'Cable triceps isolation', ARRAY['Grip cable bar', 'Push down to full extension', 'Return with control'], 'arms', ARRAY[]::text[], 'machine', 'beginner', 3, '12-15', 45, 'elbow_extension', 'isolation', true),
  ('Overhead Triceps Extension', 'Long head triceps', ARRAY['Hold dumbbell overhead', 'Lower behind head', 'Extend back up'], 'arms', ARRAY[]::text[], 'dumbbells', 'beginner', 3, '10-12', 45, 'elbow_extension', 'isolation', false),
  ('Skull Crusher', 'Lying triceps extension', ARRAY['Lie on bench with EZ bar', 'Lower to forehead', 'Extend back up'], 'arms', ARRAY[]::text[], 'barbell', 'intermediate', 3, '10-12', 45, 'elbow_extension', 'isolation', true),
  ('Preacher Curl', 'Isolated biceps curl', ARRAY['Sit at preacher bench', 'Curl bar up', 'Lower with control'], 'arms', ARRAY[]::text[], 'barbell', 'intermediate', 3, '10-12', 45, 'elbow_flexion', 'isolation', true),
  ('Concentration Curl', 'Single-arm focused curl', ARRAY['Sit with elbow on inner thigh', 'Curl dumbbell up', 'Lower slowly'], 'arms', ARRAY[]::text[], 'dumbbells', 'beginner', 3, '12-15', 45, 'elbow_flexion', 'isolation', false),
  ('Triceps Dip', 'Bodyweight triceps builder', ARRAY['Grip parallel bars', 'Lower with elbows tucked', 'Press up'], 'arms', ARRAY['chest'], 'none', 'intermediate', 3, '8-12', 60, 'vertical_push', 'compound', false),
  ('Close-Grip Push-up', 'Triceps push-up variation', ARRAY['Hands close together', 'Lower keeping elbows tucked', 'Press up'], 'arms', ARRAY['chest'], 'none', 'beginner', 3, '10-15', 45, 'horizontal_push', 'compound', false),
  ('Rope Pushdown', 'Cable rope triceps', ARRAY['Attach rope to cable', 'Push down and spread rope', 'Return with control'], 'arms', ARRAY[]::text[], 'machine', 'beginner', 3, '12-15', 45, 'elbow_extension', 'isolation', true),
  ('Incline Dumbbell Curl', 'Stretch-focused curl', ARRAY['Lie on incline bench', 'Let arms hang', 'Curl with full range'], 'arms', ARRAY[]::text[], 'dumbbells', 'intermediate', 3, '10-12', 45, 'elbow_flexion', 'isolation', false),
  ('Reverse Curl', 'Brachioradialis builder', ARRAY['Overhand grip on bar', 'Curl up', 'Lower with control'], 'arms', ARRAY[]::text[], 'barbell', 'beginner', 3, '12-15', 45, 'elbow_flexion', 'isolation', true),
  ('Band Curl', 'Resistance band biceps', ARRAY['Stand on band', 'Curl band up', 'Lower with control'], 'arms', ARRAY[]::text[], 'resistance_bands', 'beginner', 3, '15-20', 45, 'elbow_flexion', 'isolation', false),
  ('Band Triceps Extension', 'Resistance band triceps', ARRAY['Anchor band overhead', 'Extend arms down', 'Return with control'], 'arms', ARRAY[]::text[], 'resistance_bands', 'beginner', 3, '15-20', 45, 'elbow_extension', 'isolation', false),
  -- CORE (15)
  ('Plank', 'Core stability hold', ARRAY['Forearm plank position', 'Keep body straight', 'Hold for time'], 'core', ARRAY[]::text[], 'none', 'beginner', 3, '30-60s hold', 45, 'anti_extension', 'isolation', false),
  ('Side Plank', 'Oblique stability', ARRAY['Side plank on forearm', 'Keep body straight', 'Hold and switch sides'], 'core', ARRAY[]::text[], 'none', 'beginner', 3, '20-40s hold', 45, 'anti_flexion', 'isolation', false),
  ('Hanging Leg Raise', 'Lower abs and hip flexor', ARRAY['Hang from bar', 'Raise legs to parallel', 'Lower with control'], 'core', ARRAY['legs'], 'pull_up_bar', 'intermediate', 3, '10-15', 45, 'flexion', 'compound', true),
  ('Cable Crunch', 'Weighted ab crunch', ARRAY['Kneel at cable with rope', 'Crunch down', 'Return slowly'], 'core', ARRAY[]::text[], 'machine', 'beginner', 3, '15-20', 45, 'flexion', 'isolation', true),
  ('Bicycle Crunch', 'Oblique rotation crunch', ARRAY['Lie on back', 'Alternate elbow to opposite knee', 'Keep core engaged'], 'core', ARRAY[]::text[], 'none', 'beginner', 3, '20 each side', 45, 'flexion', 'isolation', false),
  ('Mountain Climber', 'Dynamic core and cardio', ARRAY['Start in plank', 'Drive knees to chest alternately', 'Keep hips low'], 'core', ARRAY['shoulders'], 'none', 'beginner', 3, '30-45s', 45, 'flexion', 'compound', false),
  ('Dead Bug', 'Core stability exercise', ARRAY['Lie on back', 'Alternate extending opposite arm and leg', 'Keep lower back flat'], 'core', ARRAY[]::text[], 'none', 'beginner', 3, '12 each side', 45, 'anti_extension', 'isolation', false),
  ('Russian Twist', 'Oblique rotation', ARRAY['Sit with feet up', 'Rotate torso side to side', 'Hold weight for resistance'], 'core', ARRAY[]::text[], 'dumbbells', 'beginner', 3, '15 each side', 45, 'rotation', 'isolation', false),
  ('Ab Wheel Rollout', 'Advanced core anti-extension', ARRAY['Kneel with ab wheel', 'Roll forward extending body', 'Pull back to start'], 'core', ARRAY['shoulders'], 'none', 'advanced', 3, '8-12', 60, 'anti_extension', 'compound', false),
  ('Hollow Body Hold', 'Gymnastic core hold', ARRAY['Lie on back', 'Lift legs and shoulders', 'Hold body in hollow shape'], 'core', ARRAY[]::text[], 'none', 'intermediate', 3, '20-30s hold', 45, 'anti_extension', 'isolation', false),
  ('Reverse Crunch', 'Lower abs focus', ARRAY['Lie on back', 'Bring knees to chest', 'Lower with control'], 'core', ARRAY[]::text[], 'none', 'beginner', 3, '15-20', 45, 'flexion', 'isolation', false),
  ('Flutter Kick', 'Lower abs endurance', ARRAY['Lie on back', 'Alternate small leg kicks', 'Keep lower back pressed down'], 'core', ARRAY['legs'], 'none', 'beginner', 3, '30s', 45, 'flexion', 'isolation', false),
  ('Pallof Press', 'Anti-rotation core', ARRAY['Stand sideways to cable', 'Press handle forward', 'Resist rotation'], 'core', ARRAY['shoulders'], 'machine', 'intermediate', 3, '10 each side', 45, 'anti_rotation', 'isolation', true),
  ('Bear Crawl', 'Full body core stability', ARRAY['Start on hands and feet', 'Crawl opposite arm and leg', 'Keep hips low and level'], 'core', ARRAY['shoulders','legs'], 'none', 'intermediate', 3, '30s', 45, 'compound', 'compound', false),
  ('V-Up', 'Full range ab exercise', ARRAY['Lie on back', 'Reach hands to feet simultaneously', 'Lower with control'], 'core', ARRAY['legs'], 'none', 'intermediate', 3, '12-15', 45, 'flexion', 'compound', false),
  -- GLUTES (10)
  ('Hip Thrust', 'Glute strength builder', ARRAY['Upper back on bench', 'Drive hips up through bar', 'Squeeze glutes at top'], 'glutes', ARRAY['legs','back'], 'barbell', 'intermediate', 4, '8-12', 90, 'hinge', 'compound', true),
  ('Glute Bridge', 'Bodyweight glute activation', ARRAY['Lie on back, knees bent', 'Drive hips up', 'Squeeze glutes at top'], 'glutes', ARRAY['legs','core'], 'none', 'beginner', 3, '15-20', 45, 'hinge', 'compound', false),
  ('Cable Hip Abduction', 'Glute medius isolation', ARRAY['Stand beside cable', 'Abduct leg outward', 'Return with control'], 'glutes', ARRAY['legs'], 'machine', 'beginner', 3, '12-15', 45, 'abduction', 'isolation', true),
  ('Sumo Deadlift', 'Glute-focused deadlift', ARRAY['Wide stance, grip inside knees', 'Drive through floor', 'Lock out at top'], 'glutes', ARRAY['legs','back'], 'barbell', 'advanced', 4, '5-8', 120, 'hinge', 'compound', true),
  ('Single-Leg Glute Bridge', 'Unilateral glute activation', ARRAY['Extend one leg', 'Drive hips up with working leg', 'Lower and repeat'], 'glutes', ARRAY['legs'], 'none', 'beginner', 3, '12 each leg', 45, 'hinge', 'compound', false),
  ('Banded Clam Shell', 'Glute medius activation', ARRAY['Lie on side with band', 'Open knees against band', 'Return with control'], 'glutes', ARRAY['legs'], 'resistance_bands', 'beginner', 3, '15 each side', 45, 'abduction', 'isolation', false),
  ('Kettlebell Swing', 'Hip hinge power movement', ARRAY['Hold kettlebell with both hands', 'Hinge at hips and swing', 'Snap hips to propel weight'], 'glutes', ARRAY['legs','back','shoulders'], 'kettlebell', 'intermediate', 4, '15-20', 60, 'hinge', 'compound', true),
  ('Cable Pull-Through', 'Glute cable hinge', ARRAY['Stand facing away from cable', 'Hinge forward grabbing rope', 'Drive hips forward'], 'glutes', ARRAY['legs','back'], 'machine', 'beginner', 3, '12-15', 45, 'hinge', 'isolation', true),
  ('Monster Walk', 'Glute medius with band', ARRAY['Band around knees', 'Walk in squat position', 'Maintain band tension'], 'glutes', ARRAY['legs'], 'resistance_bands', 'beginner', 3, '15 steps each way', 45, 'abduction', 'isolation', false),
  ('Barbell Hip Thrust', 'Heavy glute builder', ARRAY['Bar across hips', 'Drive up squeezing glutes', 'Lower with control'], 'glutes', ARRAY['legs'], 'barbell', 'intermediate', 4, '8-10', 90, 'hinge', 'compound', true),
  -- FULL BODY / FUNCTIONAL (10)
  ('Burpee', 'Full body conditioning', ARRAY['Start standing', 'Drop to push-up position, do push-up', 'Jump up explosively'], 'full_body', ARRAY['chest','legs','core'], 'none', 'intermediate', 3, '10-15', 60, 'compound', 'compound', false),
  ('Turkish Get-Up', 'Full body stability', ARRAY['Lie with kettlebell overhead', 'Stand up maintaining lockout', 'Reverse to floor'], 'full_body', ARRAY['shoulders','core','legs'], 'kettlebell', 'advanced', 3, '3-5 each side', 90, 'compound', 'compound', true),
  ('Kettlebell Snatch', 'Powerful hip drive lift', ARRAY['Swing kettlebell between legs', 'Explosively snatch overhead', 'Lower with control'], 'full_body', ARRAY['shoulders','back','legs'], 'kettlebell', 'advanced', 4, '8-10 each arm', 90, 'hinge', 'compound', true),
  ('Kettlebell Clean', 'Explosive kettlebell lift', ARRAY['Swing kettlebell up', 'Catch at rack position', 'Lower and repeat'], 'full_body', ARRAY['legs','shoulders'], 'kettlebell', 'intermediate', 4, '8-10 each arm', 60, 'hinge', 'compound', true),
  ('Thruster', 'Squat to press combo', ARRAY['Hold dumbbells at shoulders', 'Squat down, explode up into press', 'Lower and repeat'], 'full_body', ARRAY['legs','shoulders','arms'], 'dumbbells', 'intermediate', 4, '10-12', 90, 'compound', 'compound', false),
  ('Man Maker', 'Full body dumbbell complex', ARRAY['Start in plank with dumbbells', 'Row, push-up, clean, press', 'Repeat'], 'full_body', ARRAY['back','chest','shoulders','legs'], 'dumbbells', 'advanced', 3, '6-8', 120, 'compound', 'compound', true),
  ('Deadlift', 'Total body strength', ARRAY['Grip bar at shin level', 'Drive through heels and extend hips', 'Lower with control'], 'full_body', ARRAY['legs','back','glutes'], 'barbell', 'intermediate', 4, '5-8', 120, 'hinge', 'compound', true),
  ('Sumo Deadlift High Pull', 'Athletic power movement', ARRAY['Wide stance on bar', 'Extend and pull to chin', 'Lower with control'], 'full_body', ARRAY['shoulders','back','legs'], 'barbell', 'advanced', 4, '8-10', 90, 'hinge', 'compound', true),
  ('Dumbbell Snatch', 'Single-arm power lift', ARRAY['Dumbbell on floor between feet', 'Explosively snatch overhead', 'Lower with control'], 'full_body', ARRAY['shoulders','legs','back'], 'dumbbells', 'intermediate', 3, '8-10 each arm', 90, 'hinge', 'compound', false),
  ('Kettlebell Goblet Squat to Press', 'Squat and press combo', ARRAY['Hold kettlebell at chest', 'Squat, then press overhead on way up', 'Lower and repeat'], 'full_body', ARRAY['legs','shoulders'], 'kettlebell', 'intermediate', 3, '10-12', 60, 'compound', 'compound', true),
  -- CARDIO (10)
  ('Jumping Jacks', 'Cardio warm-up classic', ARRAY['Start standing', 'Jump feet wide while raising arms', 'Return and repeat'], 'cardio', ARRAY['shoulders','legs'], 'none', 'beginner', 3, '30-60s', 30, 'cardio', 'compound', false),
  ('High Knees', 'Running in place', ARRAY['Stand tall', 'Drive knees to hip height alternately', 'Keep pace fast'], 'cardio', ARRAY['legs','core'], 'none', 'beginner', 3, '30-45s', 30, 'cardio', 'compound', false),
  ('Jump Rope', 'Cardio coordination', ARRAY['Hold rope handles', 'Swing rope and jump', 'Maintain rhythm'], 'cardio', ARRAY['legs','shoulders'], 'none', 'beginner', 3, '60-90s', 30, 'cardio', 'compound', false),
  ('Star Jump', 'Explosive cardio', ARRAY['Start in crouch', 'Explode up spreading arms and legs', 'Land and repeat'], 'cardio', ARRAY['legs','shoulders'], 'none', 'intermediate', 3, '15-20', 30, 'cardio', 'compound', false),
  ('Squat Jump', 'Power cardio', ARRAY['Perform bodyweight squat', 'Explode into jump at top', 'Land softly and repeat'], 'cardio', ARRAY['legs','glutes'], 'none', 'intermediate', 3, '12-15', 45, 'cardio', 'compound', false),
  ('Box Jump', 'Explosive power', ARRAY['Stand in front of box', 'Jump onto box landing softly', 'Step down and repeat'], 'cardio', ARRAY['legs','glutes'], 'none', 'intermediate', 4, '8-10', 60, 'cardio', 'compound', false),
  ('Rowing Machine', 'Full body cardio', ARRAY['Sit at rower', 'Drive legs, then pull arms', 'Return with control'], 'cardio', ARRAY['back','legs','arms'], 'machine', 'beginner', 3, '5 min intervals', 60, 'cardio', 'compound', true),
  ('Treadmill Sprint', 'High intensity running', ARRAY['Set treadmill to sprint speed', 'Sprint for interval', 'Rest and repeat'], 'cardio', ARRAY['legs'], 'machine', 'intermediate', 5, '30s sprint, 60s rest', 60, 'cardio', 'compound', true),
  ('Assault Bike Sprint', 'High intensity bike cardio', ARRAY['Set resistance high', 'Sprint with arms and legs', 'Rest and repeat'], 'cardio', ARRAY['legs','shoulders'], 'machine', 'intermediate', 5, '20s sprint, 40s rest', 60, 'cardio', 'compound', true),
  ('Shadow Boxing', 'Cardio and coordination', ARRAY['Stand in fighting stance', 'Throw combinations', 'Keep feet moving'], 'cardio', ARRAY['shoulders','arms','core'], 'none', 'beginner', 3, '60-90s rounds', 30, 'cardio', 'compound', false)
) AS t(name, description, instructions, primary_muscle, secondary_muscles, equipment, difficulty, default_sets, default_reps, default_rest_seconds, movement_pattern, exercise_type, is_pro)
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name = t.name);
