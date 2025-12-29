import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";

export interface CsvUploadResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface CsvUploadOptions {
  url: string;
  file: File;
  fieldName?: string; // Name of the field in the form data (defaults to 'file')
  additionalData?: Record<string, any>; // Additional form data fields
}

/**
 * Generic function to upload CSV files with proper authentication
 * @param options - Upload configuration options
 * @returns Promise with upload response
 */
export const uploadCsvFile = async (options: CsvUploadOptions): Promise<CsvUploadResponse> => {
  const { url, file, fieldName = 'file', additionalData = {} } = options;

  try {
    // Validate file type
    const allowedTypes = ["text/csv", "application/csv"];
    const allowedExtensions = [".csv"];
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      throw new Error("Only CSV files are allowed");
    }

    // Create FormData
    const formData = new FormData();
    formData.append(fieldName, file);

    // Add additional data to FormData
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // Make the API call using the protected axios instance
    // This will automatically include the Bearer token via the request interceptor
    const response = await apiCallProtected.post(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return {
      success: true,
      message: response.data?.message || "File uploaded successfully",
      data: response.data,
    };
  } catch (error: any) {
    console.error("CSV upload error:", error);
    
    // Extract error message from response
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        error.message || 
                        "Failed to upload file";

    return {
      success: false,
      message: errorMessage,
    };
  }
};

/**
 * Specific function for potential customers bulk upload
 * @param file - CSV file to upload
 * @returns Promise with upload response
 */
export const uploadPotentialCustomersCsv = async (file: File): Promise<CsvUploadResponse> => {
  return uploadCsvFile({
    url: URL.potentialCustomerBulkUpload,
    file,
    fieldName: 'file',
  });
};

/**
 * Generic function to download CSV templates
 * @param url - Template download URL
 * @returns Promise with download response
 */
export const downloadCsvTemplate = async (url: string): Promise<Blob> => {
  try {
    const response = await apiCallProtected.get(url, {
      responseType: "blob",
    });
    
    return response;
  } catch (error: any) {
    console.error("Template download error:", error);
    throw new Error(error.response?.data?.message || "Failed to download template");
  }
};

/**
 * Specific function to download potential customers template
 * @returns Promise with template blob
 */
export const downloadPotentialCustomersTemplate = async (): Promise<Blob> => {
  return downloadCsvTemplate(URL.potentialCustomerTemplate);
};
