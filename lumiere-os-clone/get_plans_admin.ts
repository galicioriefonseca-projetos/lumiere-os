import { env } from "./server/config/env.js";
import { getAdminDb } from "./server/firebaseAdmin.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  const db = getAdminDb();
  const plansSnap = await db.collection("plans").get();
  console.log("Plans count:", plansSnap.size);
  plansSnap.forEach(doc => {
    console.log(doc.id, doc.data().name, doc.data().active);
  });
  process.exit(0);
}
run().catch(console.error);
