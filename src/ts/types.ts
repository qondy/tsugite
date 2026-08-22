import { Timestamp } from 'firebase/firestore';

export interface Project {
  id: string;
  title: string;
  order: number;
  archived: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  completed: boolean;
  completedAt: Timestamp | null;
  order: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}
