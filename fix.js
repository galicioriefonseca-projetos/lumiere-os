const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

const correctGet = `      allow get: if canUseTutorialDemo(salonId) || isPlatformAdmin() || (
        isSignedIn() && (
          (resource != null && resource.data.ownerId == request.auth.uid) || 
          (exists(userDoc()) && userSalonId() == salonId)
        )
      );`;

const correctUpdate = `      allow update: if canUseTutorialDemo(salonId) || isPlatformAdmin() || (
        isSignedIn() && 
        (
          (resource != null && resource.data.ownerId == request.auth.uid) || 
          (exists(userDoc()) && userSalonId() == salonId && (userRole() == "owner" || userRole() == "manager" || userRole() == "admin"))
        ) && 
        (canUseTutorialDemo(salonId) || !request.resource.data.diff(resource.data).affectedKeys().hasAny([
          'plan', 'subscriptionStatus', 'activationStatus', 'paymentStatus', 'isActive', 'billingProvider', 'billingMode', 'professionalLimit', 'professionalsLimit', 'maxProfessionals', 'founderAuthorized', 'isFounderAuthorized', 'isFounder', 'subscriptionId', 'planId', 'customerId', 'checkoutUrl', 'provider', 'nextBillingDate', 'currentPeriodStart', 'currentPeriodEnd', 'lastPaymentAt', 'lastPaymentAmount', 'billingSyncRequired', 'billingSyncReason', 'pendingPlan', 'pendingOfferId', 'pendingCheckoutUrl', 'pendingCheckoutEmail', 'pendingRequestedAt', 'pendingCheckoutPurpose', 'pendingBillingActivation', 'pendingPlanChange', 'ownerId', 'ownerEmail', 'deletedAt'
        ]))
      );`;

code = code.replace(/allow get: if canUseTutorialDemo.*?;\n/s, correctGet + '\n');
code = code.replace(/allow update: if canUseTutorialDemo.*?;\n/s, correctUpdate + '\n');

fs.writeFileSync('firestore.rules', code);
