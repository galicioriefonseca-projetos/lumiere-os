import { env } from "./server/config/env.js";
import { getAdminDb } from "./server/firebaseAdmin.js";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const db = getAdminDb();
  try {
    const plansSnap = await db.collection("plans").orderBy("displayOrder", "asc").get();
    console.log("Success! count:", plansSnap.size);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
  process.exit(0);
}
run().catch(console.error);
