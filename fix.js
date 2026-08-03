import fs from 'fs';

let content = fs.readFileSync('src/pages/dashboard/SubscriptionPage.tsx', 'utf8');

// Move getPriceDifference, isUpgrade, isDowngrade inside the component, or remove them and inline them.
// Let's remove them from the outside and pass getPlan to them.

content = content.replace(/function getPriceDifference\(currentPlan: string, targetPlan: string\): number \{[\s\S]*?\}/, `function getPriceDifference(getPlan: any, currentPlan: string, targetPlan: string): number {\n  const currentAmount = getPlan(currentPlan)?.price || 0;\n  const targetAmount = getPlan(targetPlan)?.price || 0;\n  return targetAmount - currentAmount;\n}`);

content = content.replace(/function isUpgrade\(currentPlan: string, targetPlan: string\): boolean \{[\s\S]*?\}/, `function isUpgrade(getPlan: any, currentPlan: string, targetPlan: string): boolean {\n  return (getPlan(targetPlan)?.price || 0) > (getPlan(currentPlan)?.price || 0);\n}`);

content = content.replace(/function isDowngrade\(currentPlan: string, targetPlan: string\): boolean \{[\s\S]*?\}/, `function isDowngrade(getPlan: any, currentPlan: string, targetPlan: string): boolean {\n  return (getPlan(targetPlan)?.price || 0) < (getPlan(currentPlan)?.price || 0);\n}`);

content = content.replace(/getPriceDifference\(currentPlan, confirmTargetPlan\)/g, 'getPriceDifference(getPlan, currentPlan, confirmTargetPlan)');
content = content.replace(/getPriceDifference\(currentPlan, salonData\.pendingPlanChange\.targetPlan\)/g, 'getPriceDifference(getPlan, currentPlan, salonData.pendingPlanChange.targetPlan)');

content = content.replace(/isUpgrade\(currentPlan, confirmTargetPlan\)/g, 'isUpgrade(getPlan, currentPlan, confirmTargetPlan)');
content = content.replace(/isUpgrade\(currentPlan, salonData\.pendingPlanChange\.targetPlan\)/g, 'isUpgrade(getPlan, currentPlan, salonData.pendingPlanChange.targetPlan)');

content = content.replace(/isDowngrade\(currentPlan, confirmTargetPlan\)/g, 'isDowngrade(getPlan, currentPlan, confirmTargetPlan)');

// Remove PLANS_MAX_PROFESSIONALS usage
content = content.replace(/PLANS_MAX_PROFESSIONALS\[currentPlan\]/g, '(getPlan(currentPlan)?.maxProfessionals || 5)');
content = content.replace(/PLANS_MAX_PROFESSIONALS\[confirmTargetPlan\]/g, '(getPlan(confirmTargetPlan)?.maxProfessionals || 5)');
content = content.replace(/PLANS_MAX_PROFESSIONALS\[salonData\.pendingPlanChange\.targetPlan\]/g, '(getPlan(salonData.pendingPlanChange.targetPlan)?.maxProfessionals || 5)');

// Remove PLAN_NAMES where it might have been missed
content = content.replace(/PLAN_NAMES\[currentPlan\]/g, '(getPlan(currentPlan)?.name || currentPlan)');
content = content.replace(/PLAN_NAMES\[confirmTargetPlan\]/g, '(getPlan(confirmTargetPlan)?.name || confirmTargetPlan)');
content = content.replace(/PLAN_NAMES\[salonData\.pendingPlanChange\.targetPlan\]/g, '(getPlan(salonData.pendingPlanChange.targetPlan)?.name || salonData.pendingPlanChange.targetPlan)');


content = content.replace(/planInfo\?\.monthlyAmount/g, 'planInfo?.price');

content = content.replace(/PLANS_CONFIG/g, 'plans');
content = content.replace(/PLAN_RANK/g, 'plans');

fs.writeFileSync('src/pages/dashboard/SubscriptionPage.tsx', content);

// Fix OnboardingTeam
let obContent = fs.readFileSync('src/pages/onboarding/OnboardingTeam.tsx', 'utf8');
obContent = obContent.replace(/export function OnboardingTeam.*?\{/, `export function OnboardingTeam({ data, onUpdate, onNext, onBack }: OnboardingStepProps) {\n  const { getPlan } = usePlans();`);
fs.writeFileSync('src/pages/onboarding/OnboardingTeam.tsx', obContent);

