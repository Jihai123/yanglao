import { projectPlan } from './projection.js';

export function buildContributionGuidance(plan, result) {
  if (result.eligible) {
    return {
      eligible: true,
      shortageYears: 0,
      canFixBeforeClaim: true,
      recommendedContributionEndAge: Number(plan.contributionEndAge),
      claimOnlyEligible: true,
      claimOnlyShortageYears: 0,
    };
  }

  const shortageYears = Math.max(0, Number(result.minYears) - Number(result.totalContributionYears));
  const extraMonths = Math.ceil(shortageYears * 12 - 1e-9);
  const currentEndMonths = Math.round(Number(plan.contributionEndAge) * 12);
  const claimMonths = Number(plan.claimAgeMonths);
  const recommendedEndMonths = currentEndMonths + extraMonths;
  const canFixBeforeClaim = recommendedEndMonths <= claimMonths;

  const claimOnlyResult = projectPlan({ ...plan, contributionEndAge: claimMonths / 12 });
  const claimOnlyShortageYears = Math.max(0, Number(claimOnlyResult.minYears) - Number(claimOnlyResult.totalContributionYears));

  return {
    eligible: false,
    shortageYears,
    extraMonths,
    canFixBeforeClaim,
    recommendedContributionEndAge: canFixBeforeClaim ? recommendedEndMonths / 12 : null,
    claimOnlyEligible: claimOnlyResult.eligible,
    claimOnlyShortageYears,
    claimOnlyResult,
  };
}
