import {
  Anchor,
  Box,
  Button,
  FileInput,
  Grid,
  Group,
  rem,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconDownload, IconUpload } from "@tabler/icons-react";
import axios, { Axios } from "axios";
import React, { useRef } from "react";
import { URL } from "../../api/serverUrls";
import { getAPICall } from "../../service/getApiCall";
import { API_HEADER } from "../../store/storeKeys";

function TariffBulkUpload() {
  // try {
  //       const response = await getAPICall(URL.tariff, API_HEADER);
  //       console.log("tariff response val=", response);
  //       setData(response);
  //     } catch (err) {
  //       ToastNotification({
  //         type: "error",
  //         message: `Error while fetching data: ${err}`,
  //       });
  //     }
  const handleDownload = async () => {
    try {
      const response = await axios.get(
        "http://localhost:8000/api/tariff/download-template/",
        {
          responseType: "blob",
          headers: {
            Authorization: "Token 3076d7b51db0594d8e3c0ff93adbda4c4fd80dc8",
          }, // Important for binary data like CSV
        }
      );
      //   const response = await getAPICall(
      //     URL.tariffTemplate,
      //     { responseType: "blob" },
      //     API_HEADER
      //   );
      console.log("response----", response);

      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "tariff_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download CSV:", error);
    }
  };

  return (
    <>
      <Box maw={420} mx="auto" mt={50}>
        <Group justify="space-between" mb="xs">
          <Text fw={600} c={"#105476"} mb={5}>
            Bulk Upload
          </Text>
          {/* <Anchor href="/template.xlsx" download c="blue" fz="sm"> */}
            <Group gap={4}>
              <UnstyledButton
                c={"#105476"}
                // leftSection={<IconDownload size={18} />}
                variant="outline"
                onClick={handleDownload}
              >
                Download Template
              </UnstyledButton>
            </Group>
          {/* </Anchor> */}
        </Group>

        <Box
          p="xl"
          style={{
            border: "1px dashed #A6B0C3",
            borderRadius: rem(8),
            textAlign: "center",
          }}
        >
          <Stack align="center" gap={6}>
            <Box
              bg="#E7F0FD"
              style={{
                width: rem(64),
                height: rem(64),
                borderRadius: rem(999),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              //   onClick={handleBoxClick}
            >
              <IconUpload size={28} color="#105476" />
            </Box>
            <Text size="sm">Click to browse your file</Text>

            {/* <FileInput
              accept=".csv"
              placeholder="Browse File"
              variant="unstyled"
              withAsterisk={false}
              styles={{
                input: {
                  textAlign: "center",
                  fontWeight: 600,
                  color: "#1E4CA4",
                  cursor: "pointer",
                },
              }}
              onChange={(file) => handleFileChange(file)}
            /> */}
            <input
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              //   ref={fileInputRef}
              //   onChange={handleFileChange}
            />

            <Text size="xs" c="dimmed">
              Supports : csv format
            </Text>
          </Stack>
        </Box>
      </Box>
    </>
  );
}

export default TariffBulkUpload;
