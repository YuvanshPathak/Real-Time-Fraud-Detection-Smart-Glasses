import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

export const uploadFace = async (file) => {
  const formData = new FormData();
  formData.append("image", file);
  const response = await api.post("/face-check", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const uploadVoice = async (file) => {
  const formData = new FormData();
  formData.append("audio", file);
  const response = await api.post("/voice-check", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append("document", file);
  const response = await api.post("/document-check", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const uploadFaceToIdSync = async (liveFile, idFile) => {
  const formData = new FormData();
  formData.append("live_image", liveFile);
  formData.append("id_document", idFile);
  const response = await api.post("/face-to-id-sync", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const fetchRiskScore = async (multiModalPayload) => {
  const response = await api.post("/risk-score", multiModalPayload);
  return response.data;
};

export default api;
