import { getAdminDb } from "./server/firebaseAdmin.js";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const db = getAdminDb();
  const plansSnap = await db.collection("plans").get();
  plansSnap.forEach(doc => {
    console.log(doc.id, JSON.stringify(doc.data()));
  });
  process.exit(0);
}
run().catch(console.error);
