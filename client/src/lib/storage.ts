import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";

export const uploadImage = async (file: File, path: string): Promise<string> => {
  try {
    const imageRef = ref(storage, path);
    const snapshot = await uploadBytes(imageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error: any) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

export const uploadIncidentPhoto = async (file: File, incidentId: string): Promise<string> => {
  const fileName = `${Date.now()}_${file.name}`;
  const path = `incidents/${incidentId}/${fileName}`;
  return uploadImage(file, path);
};

export const uploadPatrolPointQR = async (file: File, patrolPointId: string): Promise<string> => {
  const fileName = `qr_${patrolPointId}.png`;
  const path = `patrol-points/${patrolPointId}/${fileName}`;
  return uploadImage(file, path);
};

export const deleteImage = async (url: string): Promise<void> => {
  try {
    const imageRef = ref(storage, url);
    await deleteObject(imageRef);
  } catch (error: any) {
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};
