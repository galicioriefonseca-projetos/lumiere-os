import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import fs from "fs";

const configPath = "firebase-applet-config.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const app = initializeApp(config);
// Passing the correct database ID!
const db = getFirestore(app, "ai-studio-69305056-d165-4f4e-ac10-0401d9afe35a");

async function run() {
  try {
    const q = query(collection(db, "plans"), orderBy("displayOrder", "asc"));
    const snapshot = await getDocs(q);
    console.log("Plans count:", snapshot.size);
    snapshot.forEach(doc => console.log(doc.id, doc.data()));
  } catch (err: any) {
    console.error("Client fetch error:", err);
  }
  process.exit(0);
}
run();
