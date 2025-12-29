import {
  Box,
  Modal,
  TextInput,
  Text,
  Group,
  ActionIcon,
  ScrollArea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconSend } from "@tabler/icons-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";

import { apiCallProtected } from "../../api/axios";

const ChatBotLogo = ({ size = 32 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="16" cy="16" r="16" fill="#228BE6" />
    <path
      d="M16 22C20.4183 22 24 18.4183 24 14C24 9.58172 20.4183 6 16 6C11.5817 6 8 9.58172 8 14C8 18.4183 11.5817 22 16 22Z"
      fill="white"
    />
    <path
      d="M16 19C18.7614 19 21 16.7614 21 14C21 11.2386 18.7614 9 16 9C13.2386 9 11 11.2386 11 14C11 16.7614 13.2386 19 16 19Z"
      fill="#228BE6"
    />
    <circle cx="13" cy="13" r="1" fill="white" />
    <circle cx="19" cy="13" r="1" fill="white" />
    <path
      d="M10 24C10 21.7909 11.7909 20 14 20H18C20.2091 20 22 21.7909 22 24V26H10V24Z"
      fill="white"
    />
  </svg>
);

interface ChatBotProps {
  onQuoteParsed?: (data: unknown) => void;
  onQuotationData?: (quotationData: unknown) => void;
}

const ChatBot = ({ onQuoteParsed, onQuotationData }: ChatBotProps) => {
  const viewport = useRef<HTMLDivElement>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const navigate = useNavigate();

  // Debug log to verify props
  // console.log("ChatBot props - onQuotationData:", onQuotationData);
  // console.log("ChatBot props - shouldAutoOpen:", shouldAutoOpen);

  // Handle shouldAutoOpen prop changes
  useEffect(() => {
    // Removed auto-open logic
  }, []);

  // Handle auto-open completion callback
  useEffect(() => {
    // Removed auto-open completion callback
  }, []);

  // Note: onQuoteParsed callback is available for future implementation
  // when chatbot needs to send parsed quotation data back to the parent component
  const handleQuoteData = (data: unknown) => {
    if (onQuoteParsed) {
      onQuoteParsed(data);
    }
  };

  // Suppress unused variable warning
  void handleQuoteData;
  const [messages, setMessages] = useState<
    Array<{ text: string; sender: "user" | "bot" }>
  >([
    {
      text: "Hello Nikesh! Welcome to Pulse Logistics!",
      sender: "bot",
    },
  ]);

  const [userInput, setuserInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialMessageSent = useRef(false);

  // Function to transform chatbot data format to QuotationCreate expected format
  const transformChatbotDataToQuotationFormat = (
    chatbotData: any,
    enquiryData: any
  ) => {
    console.log("Transforming chatbot data:", chatbotData);
    console.log("Enquiry data:", enquiryData);

    // Transform charges from chatbot format to expected format
    const transformedCharges =
      chatbotData.charges?.map((charge: any) => ({
        charge_name: charge.charge_name || "",
        currency_country_code: charge.currency_country_code || "INR",
        roe: 1.0, // Default ROE
        unit: charge.unit || "",
        no_of_units: charge.quantity?.toString() || "1",
        sell_per_unit: charge.rate?.toString() || "0",
        min_sell: null,
        cost_per_unit: "0", // Default cost, can be updated later
        total_cost: "0", // Will be calculated
        total_sell: charge.total?.toString() || "0",
      })) || [];

    // Transform container details if present
    const transformedFclDetails =
      chatbotData.container_details?.map((container: any) => ({
        container_type: container.container_type_code || "",
        no_of_containers: container.quantity || 0,
      })) || [];

    // Determine service type based on container details
    const serviceType =
      chatbotData.container_details && chatbotData.container_details.length > 0
        ? "FCL"
        : "LCL";

    // Create the transformed data structure by merging enquiry and quotation data
    const transformedData = {
      // Enquiry data fields
      id: enquiryData?.id || null,
      enquiry_id: enquiryData?.enquiry_id || chatbotData.enquiry_id || "",
      customer_name: enquiryData?.customer_name || "",
      enquiry_received_date: enquiryData?.enquiry_received_date || "",
      origin_name: enquiryData?.origin_name || chatbotData.origin || "",
      destination_name:
        enquiryData?.destination_name || chatbotData.destination || "",
      sales_person: enquiryData?.sales_person || "",
      sales_coordinator: enquiryData?.sales_coordinator || "",
      customer_services: enquiryData?.customer_services || "",
      service: enquiryData?.service || serviceType,
      trade: enquiryData?.trade || "Import",
      pickup: enquiryData?.pickup || false,
      delivery: enquiryData?.delivery || false,
      pickup_location: enquiryData?.pickup_location || "",
      delivery_location: enquiryData?.delivery_location || "",
      hazardous_cargo: enquiryData?.hazardous_cargo || false,
      no_of_packages: enquiryData?.no_of_packages || null,
      gross_weight: enquiryData?.gross_weight || null,
      volume_weight: enquiryData?.volume_weight || null,
      chargeable_weight: enquiryData?.chargeable_weight || null,
      volume: enquiryData?.volume || null,
      chargeable_volume: enquiryData?.chargeable_volume || null,
      container_type_name: enquiryData?.container_type_code || "",
      no_of_containers: enquiryData?.no_of_containers || 0,
      shipment_terms_name: enquiryData?.shipment_terms_code_read || "",
      quoteType: enquiryData?.quoteType || "",

      // Quotation data fields
      carrier_code: chatbotData.carrier_code || "",
      carrier: chatbotData.carrier || "",
      code: chatbotData.code || "",
      pricing_model: chatbotData.pricing_model || "",
      charges: transformedCharges,
      fcl_details: transformedFclDetails,

      // Additional fields
      quote_type: "Standard", // Default quote type
      quote_currency_country_code: "INR", // Default currency
      valid_upto: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // 30 days from now
      multi_carrier: false, // Default to single carrier
      // status: "DRAFT", // Default status
    };

    console.log("Transformed merged data:", transformedData);
    return transformedData;
  };

  // const carrierOptions = carriers.map((carrier) => ({
  //   value: carrier.carrier_code,
  //   label: carrier.carrier_name,
  // }));

  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    };
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    if (!hasInitialMessageSent.current) {
      hasInitialMessageSent.current = true;

      const sendInitialApiCall = async () => {
        try {
          const initialData = { user_id: "test", message: "home" };
          const response = await apiCallProtected.post(
            URL.chatbot,
            initialData,
            API_HEADER
          );
          console.log("Initial API Response:", response);

          // Try different response structures
          const replyText =
            response?.data?.reply ||
            (response && "reply" in response
              ? (response as { reply: string }).reply
              : null) ||
            response?.data?.data?.reply;

          if (replyText) {
            setMessages((prev) => [
              ...prev,
              { text: replyText, sender: "bot" },
            ]);
          } else {
            console.log("No reply found in response structure:", response);
            setMessages((prev) => [
              ...prev,
              {
                text: "❌ Sorry, I couldn't process the initial request. Please try again.",
                sender: "bot",
              },
            ]);
          }
        } catch (err) {
          console.error("Initial chatbot API error:", err);
          setMessages((prev) => [
            ...prev,
            {
              text: "❌ Failed to connect to the server for initial setup. Please try again later.",
              sender: "bot",
            },
          ]);
        }
      };

      sendInitialApiCall();
    }
  }, []);

  const handleSendMessage = async () => {
    const input = userInput.trim();
    if (input === "") return;

    // Add user's message to chat
    setMessages((prev) => [...prev, { text: input, sender: "user" }]);
    setuserInput("");

    const messageData = {
      user_id: "test",
      message: input,
    };

    try {
      const response = await apiCallProtected.post(
        URL.chatbot,
        messageData,
        API_HEADER
      );

      console.log("Chatbot API response:", response);
      console.log("Response data:", response?.data);
      console.log("Response data type:", typeof response?.data);

      // Try different response structures
      const replyText =
        response?.data?.reply ||
        (response && "reply" in response
          ? (response as { reply: string }).reply
          : null) ||
        response?.data?.data?.reply;

      // Check for quotation_data and enquiry_data in the response
      const quotationData =
        response?.data?.quotation_data ||
        (response && "quotation_data" in response
          ? response.quotation_data
          : null) ||
        response?.data?.data?.quotation_data ||
        null;

      const enquiryData =
        response?.data?.enquiry_data ||
        (response && "enquiry_data" in response
          ? response.enquiry_data
          : null) ||
        response?.data?.data?.enquiry_data ||
        null;

      console.log("Extracted replyText:", replyText);
      console.log("Extracted quotationData:", quotationData);
      console.log("Extracted enquiryData:", enquiryData);
      console.log("quotationData type:", typeof quotationData);
      console.log("enquiryData type:", typeof enquiryData);
      console.log(
        "quotationData keys:",
        quotationData ? Object.keys(quotationData) : "null"
      );
      console.log(
        "enquiryData keys:",
        enquiryData ? Object.keys(enquiryData) : "null"
      );

      if (replyText) {
        setMessages((prev) => [...prev, { text: replyText, sender: "bot" }]);

        // If quotation data is present, navigate to quotation-create page
        if (quotationData) {
          console.log(
            "Quotation data detected, navigating to quotation-create page"
          );

          // Transform chatbot data format to match expected format
          const transformedQuotationData =
            transformChatbotDataToQuotationFormat(quotationData, enquiryData);
          console.log("transformedQuotationData---", transformedQuotationData);

          // Close the chatbot modal first
          close();

          // Navigate to quotation-create page with the transformed quotation data
          // quotationDataFromChatbot: transformedQuotationData,
          navigate("/enquiry-create", {
            state: {
              ...transformedQuotationData,
              actionType: "create",
            },
          });
        } else if (onQuotationData) {
          // If onQuotationData callback is provided (for backward compatibility)
          console.log("Calling onQuotationData with:", quotationData);
          onQuotationData(quotationData);
        } else {
          console.log("No quotation data found in response");
        }

        // Auto-close modal after a few seconds if the reply is "fill required columns and submit to create the quotation"
        if (
          replyText.includes(
            "fill required columns and submit to create the quotation"
          )
        ) {
          console.log(
            "Detected quotation creation message, will close modal in 3 seconds"
          );
          setTimeout(() => {
            close();
          }, 3000);
        }
      } else {
        console.log("No reply found in user message response:", response);
        setMessages((prev) => [
          ...prev,
          {
            text: "❌ Sorry, I couldn't understand that. Please try again.",
            sender: "bot",
          },
        ]);
      }
    } catch (err) {
      console.error("Chatbot API error:", err);
      setMessages((prev) => [
        ...prev,
        {
          text: "❌ Failed to connect to the server. Please try again later.",
          sender: "bot",
        },
      ]);
    }
  };

  const StructuredMessageCard = ({ message }: { message: string }) => {
    // Extract header from any 📋 message
    const headerMatch = message.match(/📋\s*(.+?)(?:\n|$)/);
    const header = headerMatch ? headerMatch[1].trim() : "Information";

    // Split into lines for processing
    const lines = message
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const contentLines = lines.slice(1); // Skip the header line

    return (
      <Box
        p="md"
        style={{
          backgroundColor: "#f8f9fa",
          borderRadius: 12,
          border: "1px solid #dee2e6",
          width: "100%",
        }}
      >
        {/* Header */}
        <Text fw={600} size="sm" c="blue" mb="md">
          📋 {header}
        </Text>

        {/* Content */}
        <Box>
          {contentLines.map((line, index) => {
            // Check if line has special formatting
            if (line.startsWith("✅")) {
              return (
                <Text key={index} size="sm" c="green.7" mb="xs" fw={500}>
                  {line}
                </Text>
              );
            } else if (
              line.includes(":") &&
              !line.includes("Please") &&
              !line.includes("Type")
            ) {
              // Likely a key-value pair
              const [key, ...valueParts] = line.split(":");
              const value = valueParts.join(":").trim();
              return (
                <Group key={index} gap="xs" mb="xs">
                  <Text size="sm" fw={500} c="gray.7">
                    {key.trim()}:
                  </Text>
                  <Text size="sm" c="dark">
                    {value}
                  </Text>
                </Group>
              );
            } else if (line.startsWith("Please") || line.startsWith("Type")) {
              // Instructions/prompts
              return (
                <Text key={index} size="sm" c="orange.7" mt="md" fw={500}>
                  {line}
                </Text>
              );
            } else {
              // Regular content
              return (
                <Text key={index} size="sm" c="dark" mb="xs">
                  {line}
                </Text>
              );
            }
          })}
        </Box>
      </Box>
    );
  };

  const PricingModelSelection = ({ message }: { message: string }) => {
    // Split message into sections
    const lines = message
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    // Extract header (first line)
    const header = lines[0] || "";

    // Extract enquiry info (lines with colons)
    const enquiryInfo = lines.filter(
      (line) =>
        line.includes(":") &&
        !line.includes("Type") &&
        !line.includes("Select") &&
        !line.includes("Options:") &&
        !line.match(/^\d+\./) &&
        !line.includes("💰 Total") &&
        (line.includes("Based on enquiry:") ||
          line.includes("Customer:") ||
          line.includes("Service:") ||
          line.includes("Trade:"))
    );

    // Debug logging
    console.log("All lines:", lines);
    console.log("Enquiry info extracted:", enquiryInfo);

    // Extract options (lines starting with numbers)
    const options = lines.filter((line) => line.match(/^\d+\./));

    // Extract instruction (last line with "Type")
    const instruction = lines.find((line) => line.includes("Type"));

    return (
      <Box
        p="md"
        style={{
          backgroundColor: "#f8f9fa",
          borderRadius: 12,
          border: "1px solid #dee2e6",
          width: "100%",
        }}
      >
        {/* Header */}
        <Text fw={600} size="sm" c="blue" mb="md">
          {header}
        </Text>

        {/* Enquiry Information */}
        {enquiryInfo.length > 0 && (
          <Box mb="md">
            {enquiryInfo.map((info, index) => {
              const [key, ...valueParts] = info.split(":");
              const value = valueParts.join(":").trim();
              return (
                <Text key={index} size="sm" c="dark" mb="xs">
                  {key.trim()}: {value}
                </Text>
              );
            })}
          </Box>
        )}

        {/* Options */}
        {options.length > 0 && (
          <Box mb="md">
            <Text fw={500} size="sm" c="gray.7" mb="xs">
              Select pricing model:
            </Text>
            {options.map((option, index) => (
              <Box
                key={index}
                p="sm"
                mb="xs"
                style={{
                  backgroundColor: "#f8f9fa",
                  borderRadius: 6,
                  border: "1px solid #dee2e6",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                <Text size="sm" c="dark" fw={500}>
                  {option}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        {/* Instruction */}
        {instruction && (
          <Box
            p="sm"
            style={{
              backgroundColor: "#fff3cd",
              borderRadius: 8,
              border: "1px solid #ffeaa7",
            }}
          >
            <Text size="sm" c="orange.8" fw={500}>
              💡 {instruction}
            </Text>
            <Text size="xs" c="gray.6" mt="xs">
              Type the number of your choice (1, 2, 3, or 4) in the input field
              below
            </Text>
          </Box>
        )}
      </Box>
    );
  };

  const TariffBreakdown = ({ message }: { message: string }) => {
    // Split message into tariff section and follow-up section
    const parts = message.split(
      /(?=Options:|What would you like to do\?|Type \d+,|Select pricing model:)/
    );
    const tariffSection = parts[0];
    const followUpSection = parts[1];

    // Filter out enquiry details from the tariff section
    const filteredTariffSection = tariffSection
      .split("\n")
      .filter((line) => {
        const trimmedLine = line.trim();
        // Remove lines that contain enquiry information
        return (
          !trimmedLine.includes("Based on enquiry:") &&
          !trimmedLine.includes("Customer:") &&
          !trimmedLine.includes("Service:") &&
          !trimmedLine.includes("Trade:") &&
          !trimmedLine.includes("|") && // Remove lines with pipe separators
          trimmedLine !== ""
        ); // Keep empty lines for spacing
      })
      .join("\n");

    console.log("Raw tariff section:", tariffSection);
    console.log("Filtered tariff section:", filteredTariffSection);

    // Extract header
    let headerMatch = filteredTariffSection.match(/📋\s*(.+?)!/);
    if (!headerMatch) {
      headerMatch = filteredTariffSection.match(/📋\s*(.+?):/);
    }
    if (!headerMatch) {
      headerMatch = filteredTariffSection.match(/^(.+?):/);
    }
    const header = headerMatch ? headerMatch[1].trim() : "Pricing Breakdown";

    // Detect pricing type
    const isAsPerTariff = header.includes("As Per Tariff");
    const isPerContainer = header.includes("Per Container");
    const isAllInclusive = header.includes("All Inclusive");
    const isMenu =
      message.includes("What would you like to see?") ||
      message.includes("What would you like to do?") ||
      message.includes("Options:");

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(amount);
    };

    interface ParsedItem {
      type: "detailed" | "container" | "inclusive" | "menu";
      chargeName?: string;
      unit?: string;
      rate?: number;
      quantity?: number;
      total?: number;
      containerInfo?: string;
      amount?: number;
      containerCharges?: number;
      shipmentCharges?: number;
      menuNumber?: number;
      menuText?: string;
      subtitle?: string;
    }

    let parsedItems: ParsedItem[] = [];
    let overallTotal: number | null = null;

    if (isAsPerTariff) {
      // Original format - detailed breakdown with Unit, Rate, Quantity, Total
      // Use a more robust regex to split by bullet points and ensure we capture all charges
      const chargeBlocks = filteredTariffSection
        .split(/(?=•\s+)/)
        .filter((block) => {
          const isValid =
            block.trim() &&
            !block.includes("📋") &&
            !block.includes("💰") &&
            block.includes("Rate:") &&
            block.includes("Total:");

          // Debug: Log why each block is being filtered out
          if (!isValid) {
            console.log("Block filtered out:", {
              content: block.trim().substring(0, 100),
              hasContent: !!block.trim(),
              hasEmoji: block.includes("📋") || block.includes("💰"),
              hasRate: block.includes("Rate:"),
              hasTotal: block.includes("Total:"),
            });
          }

          return isValid;
        });

      console.log("Filtered charge blocks:", chargeBlocks);
      console.log("Number of charge blocks found:", chargeBlocks.length);

      // Debug: Show what each block contains
      chargeBlocks.forEach((block, index) => {
        console.log(`Block ${index + 1}:`, {
          hasContainerType: block.includes("Container Type:"),
          hasUnit: block.includes("Unit:"),
          hasRate: block.includes("Rate:"),
          hasTotal: block.includes("Total:"),
          content: block.trim(),
        });
      });

      // Debug: Show raw blocks before filtering
      const rawBlocks = filteredTariffSection.split(/(?=•\s+)/);
      console.log("Raw blocks before filtering:", rawBlocks);
      console.log("Raw blocks count:", rawBlocks.length);

      // Debug: Show each raw block individually
      rawBlocks.forEach((block, index) => {
        console.log(`Raw Block ${index}:`, {
          content: block.trim(),
          startsWithBullet: block.trim().startsWith("•"),
          hasRate: block.includes("Rate:"),
          hasTotal: block.includes("Total:"),
          length: block.trim().length,
        });
      });

      // Alternative splitting method for debugging
      const alternativeBlocks = filteredTariffSection
        .split("\n")
        .reduce((blocks: string[], line: string) => {
          if (line.trim().startsWith("•")) {
            blocks.push(line);
          } else if (blocks.length > 0) {
            blocks[blocks.length - 1] += "\n" + line;
          }
          return blocks;
        }, []);

      console.log("Alternative blocks:", alternativeBlocks);
      console.log("Alternative blocks count:", alternativeBlocks.length);

      // Use alternative blocks instead of chargeBlocks since they're working correctly
      const chargeBlocksToUse = alternativeBlocks.filter((block) => {
        // Check if this block contains charge information (Rate and Total)
        const hasChargeInfo =
          block.includes("Rate:") && block.includes("Total:");

        // Check if this block is just the total line (should be filtered out)
        const isJustTotalLine =
          block.trim().startsWith("💰") && !block.includes("Rate:");

        // Check if this block contains the header (should be filtered out)
        const hasHeader = block.includes("📋");

        const isValid =
          block.trim() && hasChargeInfo && !isJustTotalLine && !hasHeader;

        // Debug: Log why each block is being filtered out
        if (!isValid) {
          console.log("Alternative block filtered out:", {
            content: block.trim().substring(0, 100),
            hasContent: !!block.trim(),
            hasChargeInfo,
            isJustTotalLine,
            hasHeader,
            hasRate: block.includes("Rate:"),
            hasTotal: block.includes("Total:"),
          });
        }

        return isValid;
      });

      console.log("Filtered alternative blocks:", chargeBlocksToUse);
      console.log(
        "Number of alternative blocks found:",
        chargeBlocksToUse.length
      );

      const detailedItems = chargeBlocksToUse
        .map((block) => {
          const lines = block
            .trim()
            .split("\n")
            .map((line) => line.trim());
          let chargeName = lines[0];

          // Handle both Unit: and Container Type: formats
          const unitMatch = block.match(/Unit:\s*(.+)/);
          const containerTypeMatch = block.match(/Container Type:\s*(.+)/);
          const rateMatch = block.match(/Rate:\s*([\d.,]+)\s*INR/);
          const quantityMatch = block.match(/Quantity:\s*(\d+)/);
          const totalMatch = block.match(/Total:\s*([\d.,]+)\s*INR/);

          // Clean charge name by removing [DESTINATION] or similar suffixes and bullet point
          chargeName = chargeName
            .replace(/^•\s*/, "")
            .replace(/\s*\[.*?\]\s*$/, "")
            .trim();

          // Get unit from either Unit: or Container Type: field
          const unit = unitMatch
            ? unitMatch[1].trim()
            : containerTypeMatch
              ? containerTypeMatch[1].trim()
              : null;

          // Debug logging for each block
          console.log(`Parsing block for "${chargeName}":`, {
            hasUnit: !!unitMatch,
            hasContainerType: !!containerTypeMatch,
            hasRate: !!rateMatch,
            hasQuantity: !!quantityMatch,
            hasTotal: !!totalMatch,
            unit,
            chargeName,
          });

          if (!chargeName || !unit || !rateMatch) {
            console.log(
              `Skipping block for "${chargeName}" - missing required fields`
            );
            return null;
          }

          return {
            type: "detailed" as const,
            chargeName: chargeName,
            unit: unit,
            rate: Number(rateMatch[1].replace(/,/g, "")),
            quantity: quantityMatch ? Number(quantityMatch[1]) : 1,
            total: totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : 0,
          };
        })
        .filter((item) => item !== null);

      console.log("Parsed detailed items:", detailedItems);
      parsedItems = detailedItems as ParsedItem[];

      // Extract overall total
      const overallTotalMatch = filteredTariffSection.match(
        /💰\s*Total:\s*([\d.,]+)\s*INR/
      );
      overallTotal = overallTotalMatch
        ? Number(overallTotalMatch[1].replace(/,/g, ""))
        : null;
    } else if (isPerContainer) {
      // Per Container format - simple container rate
      const containerMatch = filteredTariffSection.match(
        /•\s*(.+?)\s+Per Container Rate:\s*([\d.,]+)\s*INR\s+Total for \d+ containers:\s*([\d.,]+)\s*INR/
      );

      if (containerMatch) {
        const [, containerInfo, rate] = containerMatch;
        parsedItems = [
          {
            type: "container" as const,
            containerInfo: containerInfo.trim(),
            rate: Number(rate.replace(/,/g, "")),
            total: Number(rate.replace(/,/g, "")), // Use rate instead of total for display
          },
        ];
        overallTotal = Number(rate.replace(/,/g, "")); // Use rate as the grand total
      }
    } else if (isAllInclusive) {
      // All Inclusive format - can have multiple container types
      const lines = filteredTariffSection
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      // Split into container blocks (sections starting with •)
      const containerBlocks: string[][] = [];
      let currentBlock: string[] = [];

      for (const line of lines) {
        if (line.startsWith("•")) {
          // Start of new container block
          if (currentBlock.length > 0) {
            containerBlocks.push(currentBlock);
          }
          currentBlock = [line];
        } else if (currentBlock.length > 0) {
          currentBlock.push(line);
        }
      }

      // Add the last block
      if (currentBlock.length > 0) {
        containerBlocks.push(currentBlock);
      }

      // Process each container block
      for (const block of containerBlocks) {
        const containerLine = block[0]; // First line has container info
        const containerInfo = containerLine.replace(/^•\s*/, "").trim();

        let containerCharges = 0;
        let shipmentCharges = 0;
        let allInclusiveTotal = 0;

        // Extract charges from the block
        for (const line of block) {
          const containerMatch = line.match(
            /Container Charges:\s*([\d.,]+)\s*INR/
          );
          const shipmentMatch = line.match(
            /Shipment Charges:\s*([\d.,]+)\s*INR/
          );
          const allInclusiveMatch = line.match(
            /All Inclusive Total:\s*([\d.,]+)\s*INR/
          );

          if (containerMatch) {
            containerCharges = Number(containerMatch[1].replace(/,/g, ""));
          }
          if (shipmentMatch) {
            shipmentCharges = Number(shipmentMatch[1].replace(/,/g, ""));
          }
          if (allInclusiveMatch) {
            allInclusiveTotal = Number(allInclusiveMatch[1].replace(/,/g, ""));
          }
        }

        // Add as a single combined item showing the breakdown
        if (containerInfo && (containerCharges > 0 || shipmentCharges > 0)) {
          parsedItems.push({
            type: "inclusive" as const,
            chargeName: containerInfo,
            amount: allInclusiveTotal || containerCharges + shipmentCharges,
            containerCharges,
            shipmentCharges,
          });
        }
      }

      // Extract final total (💰 Total All Inclusive or 💰 Total)
      const finalTotalMatch = filteredTariffSection.match(
        /💰\s*Total.*?:\s*([\d.,]+)\s*INR/
      );
      if (finalTotalMatch) {
        overallTotal = Number(finalTotalMatch[1].replace(/,/g, ""));
      } else {
        // If no final total, sum all container totals
        overallTotal = parsedItems.reduce(
          (sum, item) => sum + (item.amount || 0),
          0
        );
      }
    } else if (isMenu) {
      // Menu format - options list
      const lines = message
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      // Extract subtitle (question part)
      let subtitle = "";
      for (const line of lines) {
        if (
          line.includes("What would you like to see?") ||
          line.includes("What would you like to do?") ||
          line.includes("Options:")
        ) {
          subtitle = line;
          break;
        }
      }

      // Process all lines to find menu items
      for (const line of lines) {
        const menuMatch = line.match(/^(\d+)\.\s*(.+)$/);
        if (menuMatch) {
          const [, number, text] = menuMatch;
          parsedItems.push({
            type: "menu" as const,
            menuNumber: Number(number),
            menuText: text.trim(),
            subtitle: subtitle,
          });
        }
      }

      // If no menu items found in the main message, check the follow-up section
      if (parsedItems.length === 0 && followUpSection) {
        const followUpLines = followUpSection
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        for (const line of followUpLines) {
          const menuMatch = line.match(/^(\d+)\.\s*(.+)$/);
          if (menuMatch) {
            const [, number, text] = menuMatch;
            parsedItems.push({
              type: "menu" as const,
              menuNumber: Number(number),
              menuText: text.trim(),
              subtitle: subtitle || "Options:",
            });
          }
        }
      }
    }

    const renderDetailedItem = (item: ParsedItem, index: number) => (
      <Box
        key={index}
        p="sm"
        mb="sm"
        style={{
          backgroundColor: "white",
          borderRadius: 8,
          border: "1px solid #e9ecef",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm" c="dark">
            {item.chargeName || ""}
          </Text>
          <Text fw={700} size="sm" c="green">
            {formatCurrency(item.total || 0)}
          </Text>
        </Group>

        <Group justify="space-between" gap="md">
          <Group gap="xl">
            <Text size="xs" c="dimmed">
              <Text component="span" fw={500} c="gray.7">
                Unit:
              </Text>{" "}
              {item.unit || ""}
            </Text>
            <Text size="xs" c="dimmed">
              <Text component="span" fw={500} c="gray.7">
                Rate:
              </Text>{" "}
              {formatCurrency(item.rate || 0)}
            </Text>
            <Text size="xs" c="dimmed">
              <Text component="span" fw={500} c="gray.7">
                Qty:
              </Text>{" "}
              {item.quantity || 0}
            </Text>
          </Group>
        </Group>
      </Box>
    );

    const renderContainerItem = (item: ParsedItem, index: number) => (
      <Box
        key={index}
        p="md"
        mb="sm"
        style={{
          backgroundColor: "white",
          borderRadius: 8,
          border: "1px solid #e9ecef",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <Group justify="space-between" align="center">
          <Box>
            <Text fw={600} size="md" c="dark" mb="xs">
              Per Container Rate
            </Text>
          </Box>
          <Text fw={700} size="lg" c="blue">
            {formatCurrency(item.rate || 0)}
          </Text>
        </Group>
      </Box>
    );

    const renderInclusiveItem = (item: ParsedItem, index: number) => (
      <Box
        key={index}
        p="sm"
        mb="sm"
        style={{
          backgroundColor: "white",
          borderRadius: 8,
          border: "1px solid #e9ecef",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm" c="dark">
            {item.chargeName || ""}
          </Text>
          <Text fw={700} size="sm" c="blue">
            {formatCurrency(item.amount || 0)}
          </Text>
        </Group>

        {/* Show breakdown if container and shipment charges are available */}
        {(item.containerCharges || item.shipmentCharges) && (
          <Box mt="xs" pt="xs" style={{ borderTop: "1px solid #f1f3f4" }}>
            {item.containerCharges && item.containerCharges > 0 && (
              <Group justify="space-between" mb="xs">
                <Text size="xs" c="dimmed">
                  Container Charges:
                </Text>
                <Text size="xs" c="dimmed">
                  {formatCurrency(item.containerCharges)}
                </Text>
              </Group>
            )}
            {item.shipmentCharges && item.shipmentCharges > 0 && (
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Shipment Charges:
                </Text>
                <Text size="xs" c="dimmed">
                  {formatCurrency(item.shipmentCharges)}
                </Text>
              </Group>
            )}
          </Box>
        )}
      </Box>
    );

    const renderMenuItem = (item: ParsedItem, index: number) => {
      // Clean the menu text by removing brackets, parentheses and their content
      const cleanMenuText = (item.menuText || "")
        .replace(/\[.*?\]/g, "") // Remove square brackets and content
        .replace(/\(.*?\)/g, "") // Remove parentheses and content
        .trim();

      return (
        <Box
          key={index}
          p="xs"
          mb="xs"
          style={{
            backgroundColor: "transparent",
            border: "none",
            boxShadow: "none",
          }}
        >
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <Text fw={600} size="xs" c="blue" style={{ flexShrink: 0 }}>
              {item.menuNumber}.
            </Text>
            <Text
              fw={400}
              size="xs"
              c="dark"
              style={{ flex: 1, wordBreak: "break-word" }}
            >
              {cleanMenuText}
            </Text>
          </Group>
        </Box>
      );
    };

    return (
      <Box style={{ width: "100%" }}>
        {/* Pricing Breakdown Card */}
        <Box
          p="md"
          style={{
            backgroundColor: "#f8f9fa",
            borderRadius: 12,
            border: "1px solid #dee2e6",
            marginBottom: followUpSection ? "12px" : 0,
          }}
        >
          {/* Header */}
          <Group justify="space-between" mb="md">
            <Box>
              <Text fw={600} size="sm" c="blue">
                {header.startsWith("📋") ? "" : "📋 "}
                {header}
              </Text>
              {isMenu && parsedItems.length > 0 && parsedItems[0].subtitle && (
                <Text size="sm" c="dimmed" mt="xs">
                  {parsedItems[0].subtitle}
                </Text>
              )}
            </Box>
          </Group>

          {/* Render Items Based on Type */}
          {parsedItems.map((item, index) => {
            if (item.type === "detailed") {
              return renderDetailedItem(item, index);
            } else if (item.type === "container") {
              return renderContainerItem(item, index);
            } else if (item.type === "inclusive") {
              return renderInclusiveItem(item, index);
            } else if (item.type === "menu") {
              return renderMenuItem(item, index);
            }
            return null;
          })}

          {/* Overall Total */}
          {overallTotal && (
            <Box
              p="sm"
              mt="md"
              style={{
                backgroundColor: "#e8f5e8",
                borderRadius: 8,
                border: "2px solid #51cf66",
              }}
            >
              <Group justify="space-between">
                <Text fw={700} size="md" c="green.8">
                  💰{" "}
                  {isAllInclusive
                    ? "All Inclusive Total"
                    : isPerContainer
                      ? "Per Container Rate"
                      : "Grand Total"}
                </Text>
                <Text fw={700} size="lg" c="green.8">
                  {formatCurrency(overallTotal)}
                </Text>
              </Group>
            </Box>
          )}
        </Box>

        {/* Follow-up Message */}
        {followUpSection && (
          <Box
            p="sm"
            style={{
              backgroundColor: "#fff3cd",
              borderRadius: 8,
              border: "1px solid #ffeaa7",
            }}
          >
            <Box>
              {followUpSection
                .trim()
                .split("\n")
                .map((line, index) => (
                  <Text
                    key={index}
                    size="sm"
                    fw={500}
                    c="orange.8"
                    style={{
                      marginBottom: line.trim() === "" ? "8px" : "0px",
                    }}
                  >
                    {line.trim() === "" ? "\u00A0" : line}
                  </Text>
                ))}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <>
      <Box style={{ position: "fixed", bottom: 20, right: 20, zIndex: 1000 }}>
        <ActionIcon
          variant="filled"
          radius="xl"
          size="xl"
          color="blue"
          onClick={open}
          style={{
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            "&:hover": {
              transform: "scale(1.1)",
              transition: "transform 0.2s ease",
            },
          }}
        >
          <ChatBotLogo size={30} />
        </ActionIcon>
      </Box>

      <Modal
        opened={opened}
        onClose={close}
        size="md"
        overlayProps={{ blur: 3 }}
        transitionProps={{ transition: "fade", duration: 200 }}
        styles={{
          content: {
            position: "fixed",
            top: "50%",
            right: "20px",
            transform: "translateY(-50%)",
            height: "80vh",
            maxHeight: "600px",
            width: "400px",
            margin: 0,
            display: "flex",
            flexDirection: "column",
          },
          body: {
            flex: 1,
            display: "flex",
            flexDirection: "column",
          },
        }}
        title={
          <Box
            style={{
              background: "linear-gradient(135deg, #228BE6 0%, #4dabf7 100%)",
              color: "white",
              padding: "10px 16px",
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Box>
              <Group>
                <ChatBotLogo />
                <Text fw={500} fz={16}>
                  Pulse AI
                </Text>
              </Group>
            </Box>
          </Box>
        }
      >
        <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Box
            style={{
              flex: 1,
              backgroundColor: "#f4f6f8",
              padding: 10,
              overflow: "hidden",
            }}
          >
            <ScrollArea
              viewportRef={viewport}
              style={{
                flex: 1,
                marginBottom: 16,
                paddingRight: 10,
              }}
              type="scroll"
            >
              {messages.map((message, index) => (
                <Box
                  key={index}
                  style={{
                    maxWidth: "80%",
                    marginBottom: 12,
                    marginLeft: message.sender === "user" ? "auto" : 0,
                  }}
                >
                  <Box
                    style={{
                      padding: "10px 14px",
                      borderRadius:
                        message.sender === "user"
                          ? "16px 16px 0 16px"
                          : "16px 16px 16px 0",
                      backgroundColor:
                        message.sender === "user" ? "#DCF8C6" : "#F1F0F0",
                      color: "black",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      fontSize: "14px",
                    }}
                  >
                    {message.sender === "bot" ? (
                      (() => {
                        const text = message.text;

                        // Check if it's a pricing model selection message
                        const isPricingModelSelection =
                          text.includes("Select pricing model:") &&
                          !text.includes("💰 Total") &&
                          !text.match(/•.*?\n.*?Container Type:/s) &&
                          !text.match(/•.*?\n.*?Rate:/s) &&
                          // Check if it's NOT a detailed breakdown (has bullet points with rates)
                          !text.match(/•\s+[^•\n]+\n\s*Container Type:/s) &&
                          !text.match(/•\s+[^•\n]+\n\s*Rate:/s);

                        // Check if it's a pricing/tariff breakdown
                        const isPricingBreakdown =
                          (text.includes("As Per Tariff") ||
                            text.includes("Per Container") ||
                            text.includes("All Inclusive") ||
                            text.includes("Quotation Preview") ||
                            text.includes("What would you like to see?") ||
                            text.includes("What would you like to do?") ||
                            text.includes("Options:")) &&
                          (text.includes("💰 Total") ||
                            text.match(/•.*?\n.*?Container Type:/s) ||
                            text.match(/•.*?\n.*?Rate:/s));

                        // Debug logging for message detection
                        console.log("Message detection debug:");
                        console.log("Text:", text);
                        console.log(
                          "isPricingModelSelection:",
                          isPricingModelSelection
                        );
                        console.log("isPricingBreakdown:", isPricingBreakdown);
                        console.log(
                          "text.startsWith('📋'):",
                          text.startsWith("📋")
                        );

                        if (isPricingModelSelection) {
                          console.log("Rendering PricingModelSelection");
                          return <PricingModelSelection message={text} />;
                        } else if (isPricingBreakdown) {
                          console.log("Rendering TariffBreakdown");
                          return <TariffBreakdown message={text} />;
                        } else if (text.startsWith("📋")) {
                          console.log("Rendering StructuredMessageCard");
                          return <StructuredMessageCard message={text} />;
                        } else {
                          console.log("Rendering plain text");
                          return (
                            <Box>
                              {text.split("\n").map((line, index) => (
                                <Text
                                  key={index}
                                  size="sm"
                                  style={{
                                    marginBottom:
                                      line.trim() === "" ? "8px" : "0px",
                                  }}
                                >
                                  {line.trim() === "" ? "\u00A0" : line}
                                </Text>
                              ))}
                            </Box>
                          );
                        }
                      })()
                    ) : (
                      <Text size="sm">{message.text}</Text>
                    )}
                  </Box>
                </Box>
              ))}

              <div ref={messagesEndRef} />
            </ScrollArea>
          </Box>

          <Box
            style={{
              position: "sticky",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "10px 0",
              backgroundColor: "white",
              borderTop: "1px solid #eee",
              display: "flex",
              gap: "8px",
            }}
          >
            <TextInput
              radius="lg"
              placeholder="Enter your message..."
              value={userInput}
              onChange={(e) => setuserInput(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              style={{ flexGrow: 1 }}
            />
            <ActionIcon
              variant="filled"
              color="blue"
              size="lg"
              radius="xl"
              onClick={handleSendMessage}
              disabled={userInput.trim() === ""}
            >
              <IconSend size="1.2rem" />
            </ActionIcon>
          </Box>
        </Box>
      </Modal>
    </>
  );
};

export default ChatBot;
