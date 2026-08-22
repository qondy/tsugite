import {
  collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, getDocs,
  query, orderBy, serverTimestamp, writeBatch, DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { Task } from './types';

function toTask(id: string, data: DocumentData): Task {
  return {
    id,
    projectId: data.projectId,
    parentId: data.parentId ?? null,
    title: data.title,
    completed: data.completed ?? false,
    completedAt: data.completedAt ?? null,
    order: data.order ?? 0,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export function subscribeTasks(uid: string, callback: (tasks: Task[]) => void): () => void {
  const q = query(collection(db, 'users', uid, 'tasks'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => toTask(d.id, d.data())));
  });
}

export function createTask(
  uid: string,
  projectId: string,
  parentId: string | null,
  title: string,
  order: number,
): Promise<string> {
  return addDoc(collection(db, 'users', uid, 'tasks'), {
    projectId,
    parentId,
    title,
    completed: false,
    completedAt: null,
    order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).then((ref) => ref.id);
}

export function setTaskCompleted(uid: string, taskId: string, completed: boolean): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'tasks', taskId), {
    completed,
    completedAt: completed ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

export function renameTask(uid: string, taskId: string, title: string): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'tasks', taskId), {
    title,
    updatedAt: serverTimestamp(),
  });
}

export function deleteTask(uid: string, taskId: string): Promise<void> {
  return deleteDoc(doc(db, 'users', uid, 'tasks', taskId));
}

export async function deleteTasksByProject(uid: string, projectId: string, tasks: Task[]): Promise<void> {
  const targets = tasks.filter((t) => t.projectId === projectId);
  if (targets.length === 0) return;
  const batch = writeBatch(db);
  targets.forEach((t) => batch.delete(doc(db, 'users', uid, 'tasks', t.id)));
  await batch.commit();
}

export async function deleteTaskWithDescendants(uid: string, taskId: string, tasks: Task[]): Promise<void> {
  const idsToDelete: string[] = [];
  const collect = (id: string) => {
    idsToDelete.push(id);
    tasks.filter((t) => t.parentId === id).forEach((child) => collect(child.id));
  };
  collect(taskId);
  const batch = writeBatch(db);
  idsToDelete.forEach((id) => batch.delete(doc(db, 'users', uid, 'tasks', id)));
  await batch.commit();
}

export async function fetchTasksOnce(uid: string): Promise<Task[]> {
  const snapshot = await getDocs(query(collection(db, 'users', uid, 'tasks'), orderBy('createdAt', 'asc')));
  return snapshot.docs.map((d) => toTask(d.id, d.data()));
}
