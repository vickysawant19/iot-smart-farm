const ids = {
  endpoint: "https://cloud.appwrite.io/v1",
  projectId: "676b980b00368c9ac428",
  databaseId: "676b98d100330520283e",
  collectionId: "676b98f000287ccf8a65",
};

import { Client, Databases, ID } from "appwrite";

class AppwriteService {
  constructor() {
    this.client = new Client()
      .setEndpoint(ids.endpoint) // Your API Endpoint
      .setProject(ids.projectId); // Your project ID
    this.database = new Databases(this.client);
  }

  async storeSensorData(
    chipId,
    temperature,
    humidity,
    soilMoisture,
    lightIntensity,
    motorStatus
  ) {
    const data = {
      chipId,
      temperature,
      humidity,
      soilMoisture,
      lightIntensity,
      motorStatus: motorStatus.toString(),
    };

    try {
      const response = await this.database.createDocument(
        ids.databaseId,
        ids.collectionId,
        ID.unique(),
        data
      );
      return response;
    } catch (error) {
      //   console.log(error);
      throw error;
    }
  }
}

const appwriteService = new AppwriteService();

export default appwriteService;
