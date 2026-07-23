import { getAdminDb } from "./api/_shared/firebaseAdmin";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  try {
    const db = getAdminDb();
    console.log("Checking platformAdmins...");
    const platformAdminsSnapshot = await db.collection("platformAdmins").get();
    console.log(`Found ${platformAdminsSnapshot.size} platformAdmins:`);
    for (const doc of platformAdminsSnapshot.docs) {
      console.log(`- ID: ${doc.id}, Data:`, doc.data());
    }
  } catch (error) {
    console.error("Error inspecting DB:", error);
  }
}

run();
