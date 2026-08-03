import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Plan } from '@/billing/types';

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'plans'), orderBy('displayOrder', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const plansData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Plan[];
      setPlans(plansData.filter(p => p.active));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching plans:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getPlan = (id: string) => plans.find(p => p.id === id);

  return { plans, loading, getPlan };
}
