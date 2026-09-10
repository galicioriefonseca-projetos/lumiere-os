import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const querySnapshot = await getDocs(collection(db, 'plans'));
  console.log('Plans count:', querySnapshot.size);
  querySnapshot.forEach(doc => console.log(doc.id, doc.data().name, doc.data().active));
}

run().catch(console.error);
