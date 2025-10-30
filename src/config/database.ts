import mongoose from "mongoose";
import { env } from "./env";

let isConnected = false;

export async function connectDatabase() {
  if (isConnected) {
    console.log("✅ MongoDB déjà connecté");
    return;
  }

  try {
    await mongoose.connect(env.MONGODB_URI);
    isConnected = true;
    console.log(`✅ MongoDB connecté à ${env.MONGODB_DB}`);
  } catch (error) {
    console.error("❌ Erreur connexion MongoDB:", error);
    throw error;
  }
}

export async function disconnectDatabase() {
  if (!isConnected) return;

  await mongoose.disconnect();
  isConnected = false;
  console.log("🔌 MongoDB déconnecté");
}
