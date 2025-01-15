import { envConfig } from "@/constants/config";
import { MongoClient } from "mongodb";

const uri = `mongodb+srv://${envConfig.DB_USER}:${envConfig.DB_PASSWORD}@${envConfig.DB_NAME}.5xgvv.mongodb.net/?retryWrites=true&w=majority&appName=${envConfig.DB_NAME}`;
const options = {};

let client;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // Trong môi trường development, sử dụng biến global để lưu trữ client và promise
  // để tránh tạo nhiều instances của MongoClient
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // Trong môi trường production, tốt nhất là tạo một client mới cho mỗi request
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
