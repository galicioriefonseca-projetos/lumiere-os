import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import fs from "fs";

const configPath = "firebase-applet-config.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  try {
    const q = query(collection(db, "plans"), orderBy("displayOrder", "asc"));
    const snapshot = await getDocs(q);
    console.log("Plans count:", snapshot.size);
  } catch (err: any) {
    console.error("Client fetch error:", err);
  }
  process.exit(0);
}
run();
