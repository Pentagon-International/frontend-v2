import { useEffect } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from "mantine-react-table";
import {
  Button,
  Card,
  Group,
  Text,
  Center,
  Loader,
  Modal,
  Select,
  Stack,
  MultiSelect,
  SegmentedControl,
  ActionIcon,
  Menu,
  Box,
  UnstyledButton,
  Drawer,
  Flex,
  TextInput,
  Grid,
} from "@mantine/core";
import {
  IconPlus,
  IconUpload,
  IconUserPlus,
  IconDotsVertical,
  IconDownload,
  IconFile,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconFilterOff,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { URL } from "../../api/serverUrls";
import { ToastNotification } from "../../components";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_HEADER } from "../../store/storeKeys";
import { apiCallProtected } from "../../api/axios";
import { useDisclosure } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import { getAPICall } from "../../service/getApiCall";
import useAuthStore from "../../store/authStore";
import { useState, useCallback, useMemo } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import uploadImage from "../../assets/images/upload.png";
import {
  uploadPotentialCustomersCsv,
  downloadPotentialCustomersTemplate,
} from "../../service/csvUploadService";

// Extend User type to include is_manager
type UserWithManager = {
  is_manager?: boolean;
};

type PotentialCustomerData = {
  id: number;
  potential_id: string;
  customer: string;
  ctc_person: string;
  email_id: string;
  ctc_no: string;
  location: string;
  commodity: string;
  movements: string;
  air_sea: string;
  reference: string;
  remark: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  assigned_to?: string;
  customer_code?: string;
  ice?: string;
  pin?: string;
  phone_no?: string;
  contact_person?: string;
  iec_allotment_date?: string | null;
  ie_type?: string;
  date_of_establishment?: string;
  pan?: string;
  nature_of_concern?: string;
  address?: string;
  city?: string;
  state?: string;
  pin1?: string;
  trade_month?: string;
  total_value?: string;
  total_quantity?: string;
  unit?: string;
};

type PotentialCustomersResponse = {
  success: boolean;
  message: string;
  index: number;
  limit: number;
  total: number;
  pagination_total: number;
  data: PotentialCustomerData[];
};

type UserData = {
  id: number;
  user_id: string;
  user_name: string;
  employee_id: string;
  pulse_id: string | null;
  email_id: string;
  status: string;
};

type AssignFormValues = {
  potential_ids: string[];
  user_id: string;
};

type FilterState = {
  // customer_code: string | null; // Commented out
  commodity: string | null;
  city: string | null;
  state: string | null;
  sales_person: string | null;
};

type CityData = {
  id: number;
  city_code: string;
  city_name: string;
  status: string;
};

type StateData = {
  id: number;
  state_code: string;
  state_name: string;
};

function PotentialCustomers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [uploadOpenFlag, { close: uploadClose }] = useDisclosure(false);
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [citySearchValue, setCitySearchValue] = useState("");
  const [debouncedCitySearch] = useDebouncedValue(citySearchValue, 400);
  const [isAssigning, setIsAssigning] = useState(false);

  const form = useForm<AssignFormValues>({
    initialValues: {
      potential_ids: [],
      user_id: "",
    },
    validate: {
      potential_ids: (value) =>
        value.length === 0 ? "Please select at least one customer" : null,
      user_id: (value) => (!value ? "Please select a salesperson" : null),
    },
  });

  const filterForm = useForm<FilterState>({
    initialValues: {
      // customer_code: null, // Commented out
      commodity: null,
      city: null,
      state: null,
      sales_person: null,
    },
  });

  useEffect(() => {
    if (user?.is_manager || user?.is_staff) {
      setStatusFilter("unassigned");
    } else {
      setStatusFilter("assigned");
    }
  }, [user]);

  // Reset pagination when status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  // Clear salesperson filter when statusFilter changes to "unassigned"
  useEffect(() => {
    if (statusFilter === "unassigned") {
      filterForm.setFieldValue("sales_person", null);
    }
  }, [statusFilter, filterForm]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Fetch potential customers data using useQuery
  const {
    data: potentialCustomersData = [],
    isLoading: potentialCustomersLoading,
  } = useQuery({
    queryKey: ["potentialCustomers", statusFilter, currentPage, pageSize],
    queryFn: async () => {
      try {
        // Create filter payload based on status only
        const filterPayload = {
          filters: {
            status: statusFilter === "unassigned" ? "un-assigned" : "assigned",
          },
        };

        // Add pagination parameters to URL (convert to 0-based index)
        const paginationParams = new URLSearchParams({
          index: ((currentPage - 1) * pageSize).toString(),
          limit: pageSize.toString(),
        });

        const response = (await apiCallProtected.post(
          `${URL.potentialCustomers}?${paginationParams.toString()}`,
          filterPayload
        )) as PotentialCustomersResponse;

        if (response && response.success && Array.isArray(response.data)) {
          // Update total count for pagination
          setTotalCount(response.total || 0);
          return response.data;
        }

        return [];
      } catch (err: unknown) {
        console.error("Error fetching potential customers:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to fetch potential customers";
        ToastNotification({
          type: "error",
          message: `Error fetching potential customers: ${errorMessage}`,
        });
        return [];
      }
    },
    enabled: !!statusFilter,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // // State to store the actual applied filter values
  // const [appliedFilters, setAppliedFilters] = useState<FilterState>({
  //   customer_name: null,
  //   commodity: null,
  //   city: null,
  //   state: null,
  // });

  // // Separate query for filtered data - only runs when filters are applied
  // const {
  //   data: filteredPotentialCustomersData = [],
  //   isLoading: filteredPotentialCustomersLoading,
  //   refetch: refetchFilteredPotentialCustomers,
  // } = useQuery({
  //   queryKey: [
  //     "filteredPotentialCustomers",
  //     filtersApplied,
  //     appliedFilters,
  //     statusFilter,
  //   ],
  //   queryFn: async () => {
  //     try {
  //       if (!filtersApplied) return [];

  //       const baseFilters: Record<string, string> = {
  //         status: statusFilter === "unassigned" ? "un-assigned" : "assigned",
  //       };

  //       // Add additional filters if they have values
  //       if (appliedFilters.customer_name) {
  //         baseFilters.customer_name = appliedFilters.customer_name;
  //       }
  //       if (appliedFilters.commodity) {
  //         baseFilters.commodity = appliedFilters.commodity;
  //       }
  //       if (appliedFilters.city) {
  //         baseFilters.city = appliedFilters.city;
  //       }
  //       if (appliedFilters.state) {
  //         baseFilters.state = appliedFilters.state;
  //       }

  //       if (Object.keys(baseFilters).length === 1) return []; // Only status filter

  //       const filterPayload = { filters: baseFilters };

  //       const response = (await apiCallProtected.post(
  //         URL.potentialCustomers,
  //         filterPayload,
  //         API_HEADER
  //       )) as PotentialCustomersResponse;

  //       if (response && response.success && Array.isArray(response.data)) {
  //         return response.data;
  //       }

  //       return [];
  //     } catch (err: unknown) {
  //       console.error("Error fetching filtered potential customers:", err);
  //       const errorMessage =
  //         err instanceof Error
  //           ? err.message
  //           : "Failed to fetch filtered potential customers";
  //       ToastNotification({
  //         type: "error",
  //         message: `Error fetching filtered potential customers: ${errorMessage}`,
  //       });
  //       return [];
  //     }
  //   },
  //   enabled: false, // Don't run automatically - only when Apply Filters is clicked
  //   staleTime: 5 * 60 * 1000, // 5 minutes
  //   refetchOnWindowFocus: false,
  // });

  // Fetch user master data for salesperson dropdown
  const { data: usersData = [] } = useQuery({
    queryKey: ["userMaster"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(URL.user, API_HEADER)) as UserData[];
        return Array.isArray(response) ? response : [];
      } catch (err: unknown) {
        console.error("Error fetching user master:", err);
        ToastNotification({
          type: "error",
          message: `Error fetching user data: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredPotentialCustomersData = [],
    isLoading: filteredPotentialCustomersLoading,
  } = useQuery({
    queryKey: [
      "filteredPotentialCustomers",
      statusFilter,
      currentPage,
      pageSize,
      filtersApplied,
      // Remove filterForm.values from queryKey to prevent auto-triggering
    ],
    queryFn: async () => {
      try {
        if (!filtersApplied) return [];

        // Create filter payload with additional filters
        const baseFilters: Record<string, string> = {
          status: statusFilter === "unassigned" ? "un-assigned" : "assigned",
        };

        // Add additional filters if they have values
        // if (filterForm.values.customer_code) {
        //   baseFilters.customer_code = filterForm.values.customer_code;
        // }
        if (filterForm.values.commodity) {
          baseFilters.commodity = filterForm.values.commodity;
        }
        if (filterForm.values.city) {
          baseFilters.city = filterForm.values.city;
        }
        if (filterForm.values.state) {
          baseFilters.state = filterForm.values.state;
        }
        // Only include salesperson filter when statusFilter is "assigned"
        if (statusFilter === "assigned" && filterForm.values.sales_person) {
          baseFilters.assigned_to = filterForm.values.sales_person;
        }

        const filterPayload = { filters: baseFilters };

        // Add pagination parameters to URL (convert to 0-based index)
        const paginationParams = new URLSearchParams({
          index: ((currentPage - 1) * pageSize).toString(),
          limit: pageSize.toString(),
        });

        const response = (await apiCallProtected.post(
          `${URL.potentialCustomers}?${paginationParams.toString()}`,
          filterPayload
        )) as PotentialCustomersResponse;

        if (response && response.success && Array.isArray(response.data)) {
          // Update total count for pagination
          setTotalCount(response.total || 0);
          return response.data;
        }

        return [];
      } catch (err: unknown) {
        console.error("Error fetching filtered potential customers:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to fetch filtered potential customers";
        ToastNotification({
          type: "error",
          message: `Error fetching filtered potential customers: ${errorMessage}`,
        });
        return [];
      }
    },
    enabled: !!statusFilter && filtersApplied,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch city data with search functionality - only when user searches
  const { data: citiesData = [] } = useQuery({
    queryKey: ["cities", debouncedCitySearch],
    queryFn: async () => {
      try {
        const searchParam = debouncedCitySearch.trim()
          ? `?search=${encodeURIComponent(debouncedCitySearch.trim())}`
          : "";

        const response = (await getAPICall(
          `${URL.city}${searchParam}`,
          API_HEADER
        )) as {
          success: boolean;
          message: string;
          data: CityData[];
        };
        return Array.isArray(response.data) ? response.data : [];
      } catch (err: unknown) {
        console.error("Error fetching cities:", err);
        ToastNotification({
          type: "error",
          message: `Error fetching cities: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
        return [];
      }
    },
    enabled: debouncedCitySearch.trim().length > 0, // Only fetch when user searches
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch state data with memoization
  const { data: statesData = [] } = useQuery({
    queryKey: ["states"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(URL.state, API_HEADER)) as {
          success: boolean;
          message: string;
          data: StateData[];
        };
        return Array.isArray(response.data) ? response.data : [];
      } catch (err: unknown) {
        console.error("Error fetching states:", err);
        ToastNotification({
          type: "error",
          message: `Error fetching states: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - longer cache for static data
    refetchOnWindowFocus: false,
  });

  // Memoize city and state options for better performance
  const cityOptions = useMemo(() => {
    return citiesData.map((city) => ({
      value: city.city_name,
      label: city.city_name,
    }));
  }, [citiesData]);

  const stateOptions = useMemo(() => {
    return statesData.map((state) => ({
      value: state.state_name,
      label: state.state_name,
    }));
  }, [statesData]);

  // Fetch salespersons data
  const { data: salespersonsData = [], isLoading: salespersonsLoading } =
    useQuery({
      queryKey: ["salespersons"],
      queryFn: async () => {
        try {
          const response = await apiCallProtected.post(URL.salespersons, {});
          const data = response as any;
          return Array.isArray(data?.data) ? data.data : [];
        } catch (error) {
          console.error("Error fetching salespersons data:", error);
          return [];
        }
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });

  const salespersonOptions = useMemo(() => {
    if (!salespersonsData || !Array.isArray(salespersonsData)) return [];
    return salespersonsData
      .filter((item: any) => item?.sales_person)
      .map((item: any) => ({
        value: String(item.sales_person),
        label: String(item.sales_person),
      }));
  }, [salespersonsData]);

  // Function to apply filters manually
  const applyFilters = useCallback(async () => {
    try {
      // Check if there are any actual filter values
      // Exclude sales_person when statusFilter is "unassigned"
      const hasFilterValues =
        filterForm.values.commodity ||
        filterForm.values.city ||
        filterForm.values.state ||
        (statusFilter === "assigned" && filterForm.values.sales_person);

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data
        setFiltersApplied(false);
        setCurrentPage(1); // Reset to first page
        return;
      }

      // Mark filters as applied and reset to first page
      setFiltersApplied(true);
      setCurrentPage(1);

      // Invalidate and refetch the filtered query
      await queryClient.invalidateQueries({
        queryKey: ["filteredPotentialCustomers"],
      });
      setShowFilters(false);
    } catch (error) {
      console.error("Error applying filters:", error);
      ToastNotification({
        type: "error",
        message: "Error applying filters",
      });
      setShowFilters(false);
    }
  }, [filterForm.values, statusFilter, queryClient]);

  // Function to clear all filters
  const clearAllFilters = useCallback(async () => {
    try {
      setShowFilters(false);

      filterForm.reset(); // Reset form to initial values
      setFiltersApplied(false); // Reset filters applied state
      setCurrentPage(1); // Reset to first page

      // Invalidate queries and refetch unfiltered data
      await queryClient.invalidateQueries({ queryKey: ["potentialCustomers"] });
      await queryClient.invalidateQueries({
        queryKey: ["filteredPotentialCustomers"],
      });

      ToastNotification({
        type: "success",
        message: "All filters cleared successfully",
      });
    } catch (error) {
      console.error("Error clearing filters:", error);
    }
  }, [filterForm, queryClient]);

  // Determine which data to display
  const displayData = useMemo(() => {
    // Check if we have filtered data (filters were applied)
    if (filtersApplied) {
      return filteredPotentialCustomersData;
    }
    return potentialCustomersData;
  }, [potentialCustomersData, filteredPotentialCustomersData, filtersApplied]);

  // Loading state
  const isLoading = useMemo(() => {
    if (filtersApplied) {
      return filteredPotentialCustomersLoading;
    }
    return potentialCustomersLoading;
  }, [
    potentialCustomersLoading,
    filteredPotentialCustomersLoading,
    filtersApplied,
  ]);

  const handleCreateCallEntry = useCallback(
    (customerData: PotentialCustomerData) => {
      // Navigate to call entry create page with customer data
      navigate("/call-entry-create", {
        state: {
          fromPotentialCustomer: true,
          customerCode: customerData.customer_code || customerData.potential_id,
          customerName: customerData.customer,
          customerData: customerData,
        },
      });
    },
    [navigate]
  );

  // File validation function
  const validateFile = (file: File): boolean => {
    const allowedTypes = ["text/csv", "application/csv"];
    const allowedExtensions = [".csv"];
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));

    return (
      allowedTypes.includes(file.type) ||
      allowedExtensions.includes(fileExtension)
    );
  };

  // Handle file upload
  const handleFileUpload = (file: File) => {
    setFileError(null);

    if (!validateFile(file)) {
      setFileError("Only CSV files are allowed");
      return;
    }
    // console.log("fileeeeeee----", file);

    setUploadedFile(file);
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Handle file removal
  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileError(null);
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!uploadedFile) {
      setFileError("Please upload a CSV file");
      return;
    }

    if (!validateFile(uploadedFile)) {
      setFileError("Only CSV files are allowed");
      return;
    }

    try {
      console.log("Uploading file:", uploadedFile);

      const response = await uploadPotentialCustomersCsv(uploadedFile);

      if (response.success) {
        ToastNotification({
          type: "success",
          message: response.message,
        });

        // Invalidate and refetch the potential customers query to update the list
        await queryClient.invalidateQueries({
          queryKey: ["potentialCustomers"],
        });

        // Reset form
        setUploadedFile(null);
        setFileError(null);
        uploadClose();
      } else {
        ToastNotification({
          type: "error",
          message: response.message,
        });
      }
    } catch (error: unknown) {
      console.error("Upload error:", error);
      ToastNotification({
        type: "error",
        message: `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  };

  async function downloadTemplate() {
    try {
      const blob = await downloadPotentialCustomersTemplate();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "potential_customers_template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      ToastNotification({
        type: "success",
        message: "Template downloaded successfully",
      });
    } catch (error: unknown) {
      console.error("Download template error:", error);
      ToastNotification({
        type: "error",
        message: `Failed to download template: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  // // Filter functions
  // const applyFilters = async () => {
  //   try {
  //     console.log("Applying filters...");
  //     console.log("Current filters:", filterForm.values);

  //     // Check if there are any actual filter values
  //     const hasFilterValues =
  //       filterForm.values.customer_name ||
  //       filterForm.values.commodity ||
  //       filterForm.values.city ||
  //       filterForm.values.state;

  //     if (!hasFilterValues) {
  //       // If no filter values, show unfiltered data
  //       setFiltersApplied(false);
  //       setAppliedFilters({
  //         customer_name: null,
  //         commodity: null,
  //         city: null,
  //         state: null,
  //       });

  //       // Invalidate and refetch unfiltered data
  //       await queryClient.invalidateQueries({
  //         queryKey: ["potentialCustomers"],
  //       });
  //       await refetchPotentialCustomers();

  //       console.log("No filter values provided, showing unfiltered data");
  //       return;
  //     }

  //     setFiltersApplied(true); // Mark filters as applied

  //     // Store the current filter form values as applied filters
  //     setAppliedFilters({
  //       customer_name: filterForm.values.customer_name,
  //       commodity: filterForm.values.commodity,
  //       city: filterForm.values.city,
  //       state: filterForm.values.state,
  //     });

  //     // Enable the filtered query and refetch
  //     await queryClient.invalidateQueries({
  //       queryKey: ["filteredPotentialCustomers"],
  //     });
  //     await refetchFilteredPotentialCustomers();

  //     console.log("Filters applied successfully");
  //   } catch (error) {
  //     console.error("Error applying filters:", error);
  //   }
  // };

  // const clearAllFilters = async () => {
  //   filterForm.reset(); // Reset form to initial values
  //   setFiltersApplied(false); // Reset filters applied state

  //   // Reset applied filters state
  //   setAppliedFilters({
  //     customer_name: null,
  //     commodity: null,
  //     city: null,
  //     state: null,
  //   });

  //   // Invalidate queries and refetch unfiltered data
  //   await queryClient.invalidateQueries({ queryKey: ["potentialCustomers"] });
  //   await queryClient.invalidateQueries({
  //     queryKey: ["filteredPotentialCustomers"],
  //   });
  //   await queryClient.removeQueries({
  //     queryKey: ["filteredPotentialCustomers"],
  //   }); // Remove filtered data from cache
  //   await refetchPotentialCustomers();

  //   ToastNotification({
  //     type: "success",
  //     message: "All filters cleared successfully",
  //   });
  // };

  const columns = useMemo<MRT_ColumnDef<PotentialCustomerData>[]>(() => {
    const baseColumns: MRT_ColumnDef<PotentialCustomerData>[] = [
      {
        accessorKey: "sno",
        header: "S.No",
        size: 60,
        minSize: 50,
        maxSize: 70,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "customer",
        header: "CUSTOMER",
        size: 250,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "email_id",
        header: "EMAIL ID",
        size: 200,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "commodity",
        header: "COMMODITY",
        size: 120,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "ice",
        header: "ICE",
        size: 120,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "pin",
        header: "PIN",
        size: 100,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "phone_no",
        header: "PHONE NO.",
        size: 130,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "contact_person",
        header: "CONTACT PERSON",
        size: 180,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "address",
        header: "ADDRESS",
        size: 200,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "city",
        header: "CITY",
        size: 150,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "state",
        header: "STATE",
        size: 120,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "total_value",
        header: "TOTAL VALUE",
        size: 120,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "total_quantity",
        header: "TOTAL QUANTITY",
        size: 130,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "unit",
        header: "UNIT",
        size: 80,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
    ];

    // Only add actions column when statusFilter is "assigned"
    if (statusFilter === "assigned") {
      baseColumns.push(
        {
          accessorKey: "assigned_to",
          header: "Assigned to",
          size: 130,
          Cell: ({ cell }): string => String(cell.getValue() || "-"),
        },
        {
          accessorKey: "created_at",
          header: "Assigned date",
          size: 100,
          Cell: ({ cell }): string => String(cell.getValue() || "-"),
        },
        {
          id: "actions",
          header: "Actions",
          size: 80,
          Cell: ({ row }) => (
            <Menu withinPortal position="bottom-end" shadow="sm" radius={"md"}>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => handleCreateCallEntry(row.original)}
                  >
                    <Group gap={"sm"}>
                      <IconPlus size={16} style={{ color: "#105476" }} />
                      <Text size="sm">Create call entry</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
              </Menu.Dropdown>
            </Menu>
          ),
        }
      );
    }

    return baseColumns;
  }, [statusFilter, handleCreateCallEntry]);

  const table = useMantineReactTable({
    columns,
    data: displayData,
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    layoutMode: "grid",
    // Pagination configuration
    paginationDisplayMode: "pages",
    initialState: {
      pagination: {
        pageIndex: currentPage - 1, // Convert to 0-based for table
        pageSize: pageSize,
      },
    },
    state: {
      pagination: {
        pageIndex: currentPage - 1, // Convert to 0-based for table
        pageSize: pageSize,
      },
    },
    onPaginationChange: (updater) => {
      if (typeof updater === "function") {
        const newPagination = updater({
          pageIndex: currentPage - 1,
          pageSize: pageSize,
        });
        setCurrentPage(newPagination.pageIndex + 1); // Convert back to 1-based
        setPageSize(newPagination.pageSize);
      } else {
        setCurrentPage(updater.pageIndex + 1); // Convert back to 1-based
        setPageSize(updater.pageSize);
      }
    },
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pageSize),
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
      style: { width: "100%" },
    },
    mantinePaperProps: {
      shadow: "sm",
      p: "md",
      radius: "md",
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "8px 12px",
        fontSize: "13px",
        backgroundColor: "#ffffff",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "6px 12px",
        fontSize: "12px",
        backgroundColor: "#ffffff",
        top: 0,
        zIndex: 3,
        borderBottom: "1px solid #e9ecef",
        fontWeight: 600,
      },
    },
    mantineTableContainerProps: {
      style: {
        fontSize: "13px",
        width: "100%",
        minHeight: "300px",
        maxHeight: "59vh",
        overflowY: "auto",
        overflowX: "auto",
        position: "relative",
      },
    },
  });

  const handleAssign = async (values: AssignFormValues) => {
    setIsAssigning(true);
    try {
      // Create payload in the required format
      const payload = {
        user_id: parseInt(values.user_id),
        potential_ids: values.potential_ids.map((id) => parseInt(id)),
      };

      // Call the API
      await apiCallProtected.post(URL.userPotentialMaster, payload, API_HEADER);

      ToastNotification({
        type: "success",
        message: "Customers assigned to salesperson successfully",
      });

      // Invalidate and refetch the potential customers queries to update the list
      await queryClient.invalidateQueries({
        queryKey: ["potentialCustomers"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["filteredPotentialCustomers"],
      });

      // Reset form and close modal
      form.reset();
      close();
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message: `Error assigning customers: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Text size="md" fw={600} c={"#105476"}>
            Potential Customers
          </Text>

          <Drawer
            opened={uploadOpenFlag}
            onClose={uploadClose}
            title="Potential Customers Bulk Upload"
            position="right"
            size="70%"
            // p={"xl"}
          >
            <Stack gap="xl" p="xl">
              <Flex gap="xl" align="flex-start" wrap="wrap">
                {/* Bulk Upload Section */}
                <Box
                  // flex={1}
                  style={{ minWidth: 320 }}
                >
                  <Group justify="space-between" align="center" mb="md">
                    <Text fw={600} size="lg">
                      Bulk Upload
                    </Text>
                    <Button
                      variant="subtle"
                      c="#105476"
                      leftSection={<IconDownload size={14} />}
                      styles={{
                        root: {
                          padding: 0,
                          height: "auto",
                          backgroundColor: "transparent",
                          "&:hover": { backgroundColor: "transparent" },
                        },
                      }}
                    >
                      <Text
                        td="underline"
                        c="#105476"
                        size="sm"
                        onClick={() => downloadTemplate()}
                      >
                        Download Template
                      </Text>
                    </Button>
                  </Group>

                  {/* Upload Box */}
                  <Box
                    component="label"
                    htmlFor="file-upload"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                      border: `3px dashed ${dragActive ? "#0A74A6" : "#105476"}`,
                      borderRadius: "8px",
                      padding: "3rem 7rem",
                      textAlign: "center",
                      backgroundColor: dragActive ? "#f0f8ff" : "#fafafa",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      transition: "all 0.2s ease",
                      cursor: "pointer",
                    }}
                  >
                    <img
                      src={uploadImage}
                      alt="Upload"
                      style={{
                        width: "60px",
                        height: "60px",
                        marginBottom: "1rem",
                      }}
                    />

                    <Text size="sm" mb="xs" c="dark">
                      Drag and drop here or{" "}
                      <span
                        style={{
                          color: "#105476",
                          textDecoration: "underline",
                          fontWeight: 500,
                        }}
                      >
                        Browse File
                      </span>
                    </Text>

                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv"
                      style={{ display: "none" }}
                      onChange={handleInputChange}
                    />

                    <Text size="xs" c="dimmed">
                      Supports: .csv format only
                    </Text>
                  </Box>
                </Box>

                {/* Uploaded File Section - Only show when file is uploaded */}
                {uploadedFile && (
                  <Box flex={1} style={{ minWidth: 300 }}>
                    <Text fw={600} size="lg" mb="md">
                      Uploaded File
                    </Text>

                    <Box
                      style={{
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        padding: "1rem",
                        backgroundColor: "#fafafa",
                      }}
                    >
                      <Group justify="space-between" align="center">
                        <Group gap="sm" wrap="nowrap">
                          <IconFile color="#105476" size={24} />
                          <Box>
                            <Text size="sm" fw={500} c="dark">
                              {uploadedFile.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              ({(uploadedFile.size / 1024).toFixed(2)} KB)
                            </Text>
                          </Box>
                        </Group>
                        <ActionIcon
                          variant="transparent"
                          color="gray"
                          size="sm"
                          onClick={handleRemoveFile}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                    </Box>
                  </Box>
                )}
              </Flex>

              {/* Error Display */}
              {fileError && (
                <Box
                  style={{
                    backgroundColor: "#fee",
                    border: "1px solid #fcc",
                    borderRadius: "8px",
                    padding: "1rem",
                  }}
                >
                  <Text size="sm" c="red">
                    {fileError}
                  </Text>
                </Box>
              )}

              {/* Action Buttons */}
              <Group justify="flex-end" gap="sm" mt="xl">
                <Button variant="outline" color="#105476" onClick={uploadClose}>
                  Cancel
                </Button>
                <Button
                  color="#105476"
                  leftSection={<IconUpload size={16} />}
                  onClick={handleSubmit}
                >
                  Submit
                </Button>
              </Group>
            </Stack>
          </Drawer>
          <Modal
            opened={opened}
            onClose={close}
            title="Assign Customers to Salesperson"
            centered
            size="md"
          >
            <form onSubmit={form.onSubmit(handleAssign)}>
              <Stack gap="md">
                <MultiSelect
                  label="Customer Names"
                  placeholder="Select customers"
                  data={displayData.map((customer) => ({
                    value: customer.id.toString(),
                    label: customer.customer,
                  }))}
                  {...form.getInputProps("potential_ids")}
                  searchable
                  clearable
                  required
                />

                <Select
                  label="Salesperson"
                  placeholder="Select a salesperson"
                  data={usersData
                    .filter((user) => user.status === "ACTIVE")
                    .map((user) => ({
                      value: user.id.toString(),
                      label: user.user_name,
                    }))}
                  {...form.getInputProps("user_id")}
                  searchable
                  clearable
                  required
                />

                <Group justify="flex-end" gap="sm" mt="md">
                  <Button
                    variant="outline"
                    onClick={close}
                    disabled={isAssigning}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    color="#105476"
                    loading={isAssigning}
                    disabled={isAssigning}
                  >
                    Assign
                  </Button>
                </Group>
              </Stack>
            </form>
          </Modal>

          <Group gap="sm" wrap="nowrap">
            <Button
              variant="outline"
              leftSection={<IconFilter size={16} />}
              size="xs"
              color="#105476"
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
            {((user as UserWithManager)?.is_manager || user?.is_staff) && (
              <>
                <SegmentedControl
                  value={statusFilter}
                  onChange={(value) =>
                    setStatusFilter(value as "assigned" | "unassigned")
                  }
                  data={[
                    { label: "Assigned", value: "assigned" },
                    { label: "Unassigned", value: "unassigned" },
                  ]}
                  size="xs"
                  color="#105476"
                />
                {/* <Button
                  variant="outline"
                  leftSection={<IconUpload size={16} />}
                  size="xs"
                  color="#105476"
                  onClick={uploadOpen}
                >
                  Upload
                </Button> */}
                {statusFilter === "unassigned" && (
                  <Button
                    variant="outline"
                    leftSection={<IconUserPlus size={16} />}
                    size="xs"
                    color="#105476"
                    onClick={open}
                  >
                    Assign to salesperson
                  </Button>
                )}
              </>
            )}
          </Group>
        </Group>

        {/* Filter Section */}
        {showFilters && (
          <Card
            shadow="xs"
            padding="md"
            radius="md"
            withBorder
            mb="md"
            bg="#f8f9fa"
          >
            <Group justify="space-between" align="center">
              <Group align="center" gap="xs">
                <IconFilter size={16} color="#105476" />
                <Text size="sm" fw={500} c="#105476">
                  Filters
                </Text>
              </Group>
            </Group>

            <Grid>
              <Grid.Col span={12}>
                <Grid>
                  {/* Sales Person Filter - Only show when statusFilter is "assigned" and should be first */}
                  {statusFilter === "assigned" && (
                    <Grid.Col span={2.4}>
                      <Select
                        key={`sales-person-${filterForm.values.sales_person}-${salespersonsLoading}-${salespersonOptions.length}`}
                        label="Sales Person"
                        placeholder={
                          salespersonsLoading
                            ? "Loading salespersons..."
                            : "Select Sales Person"
                        }
                        searchable
                        clearable
                        size="xs"
                        data={salespersonOptions}
                        nothingFoundMessage={
                          salespersonsLoading
                            ? "Loading salespersons..."
                            : "No salespersons found"
                        }
                        disabled={salespersonsLoading}
                        value={filterForm.values.sales_person}
                        onChange={(value) =>
                          filterForm.setFieldValue(
                            "sales_person",
                            value || null
                          )
                        }
                        onFocus={(event) => {
                          const input = event.target as HTMLInputElement;
                          if (input && input.value) {
                            input.select();
                          }
                        }}
                        styles={{
                          input: { fontSize: "12px" },
                          label: {
                            fontSize: "12px",
                            fontWeight: 500,
                            color: "#495057",
                          },
                        }}
                      />
                    </Grid.Col>
                  )}

                  {/* Customer Name Filter - Commented out */}
                  {/* <Grid.Col span={2.4}>
                    <SearchableSelect
                      size="xs"
                      label="Customer Name"
                      placeholder="Type customer name"
                      apiEndpoint={URL.customer}
                      searchFields={["customer_name", "customer_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.customer_code),
                        label: String(item.customer_name),
                      })}
                      value={filterForm.values.customer_code}
                      onChange={(value) =>
                        filterForm.setFieldValue("customer_code", value || "")
                      }
                      minSearchLength={2}
                    />
                  </Grid.Col> */}

                  {/* City Filter */}
                  <Grid.Col span={2.4}>
                    <Select
                      label="City"
                      placeholder="Type to search city"
                      size="xs"
                      data={cityOptions}
                      value={filterForm.values.city}
                      onChange={(value) =>
                        filterForm.setFieldValue("city", value)
                      }
                      searchable
                      clearable
                      searchValue={citySearchValue}
                      onSearchChange={setCitySearchValue}
                      nothingFoundMessage={
                        citySearchValue.trim().length === 0
                          ? "Type to search cities"
                          : "No cities found"
                      }
                      styles={{
                        input: { fontSize: "12px" },
                        label: {
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#495057",
                        },
                      }}
                    />
                  </Grid.Col>

                  {/* State Filter */}
                  <Grid.Col span={2.4}>
                    <Select
                      label="State"
                      placeholder="Select State"
                      size="xs"
                      data={stateOptions}
                      value={filterForm.values.state}
                      onChange={(value) =>
                        filterForm.setFieldValue("state", value)
                      }
                      searchable
                      clearable
                      styles={{
                        input: { fontSize: "12px" },
                        label: {
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#495057",
                        },
                      }}
                    />
                  </Grid.Col>

                  {/* Commodity Filter */}
                  <Grid.Col span={2.4}>
                    <TextInput
                      label="Commodity"
                      placeholder="Search Commodity"
                      size="xs"
                      value={filterForm.values.commodity || ""}
                      onChange={(e) =>
                        filterForm.setFieldValue(
                          "commodity",
                          e.currentTarget.value || null
                        )
                      }
                      styles={{
                        input: { fontSize: "12px" },
                        label: {
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#495057",
                        },
                      }}
                    />
                  </Grid.Col>
                </Grid>
              </Grid.Col>
            </Grid>

            <Group justify="end" mt="sm">
              <Button
                size="xs"
                variant="outline"
                color="#105476"
                leftSection={<IconFilterOff size={14} />}
                onClick={clearAllFilters}
              >
                Clear Filters
              </Button>
              <Button
                size="xs"
                variant="filled"
                color="#105476"
                leftSection={
                  isLoading ? <Loader size={14} /> : <IconFilter size={14} />
                }
                onClick={applyFilters}
                loading={isLoading}
                disabled={isLoading}
              >
                Apply Filters
              </Button>
            </Group>
          </Card>
        )}

        {isLoading ? (
          <Center style={{ minHeight: "300px" }}>
            <Loader size="lg" color="#105476" />
          </Center>
        ) : displayData.length === 0 ? (
          <Center style={{ minHeight: "300px" }}>
            <Text c="dimmed" size="lg">
              No data available
            </Text>
          </Center>
        ) : (
          <>
            <MantineReactTable table={table} />

            {/* Custom Pagination Bar */}
            <Group
              w="100%"
              justify="space-between"
              align="center"
              px="md"
              py="xs"
              style={{ borderTop: "1px solid #e9ecef" }}
              wrap="nowrap"
              mt="xs"
            >
              {/* Rows per page and range */}
              <Group gap="sm" align="center" wrap="nowrap" mt={10}>
                <Text size="sm" c="dimmed">
                  Rows per page
                </Text>
                <Select
                  size="xs"
                  data={["10", "25", "50"]}
                  value={String(pageSize)}
                  onChange={(val) => {
                    if (!val) return;
                    handlePageSizeChange(Number(val));
                  }}
                  w={110}
                  styles={{ input: { fontSize: 12, height: 30 } }}
                />
                <Text size="sm" c="dimmed">
                  {(() => {
                    if (totalCount === 0) return "0–0 of 0";
                    const start = (currentPage - 1) * pageSize + 1;
                    const end = Math.min(currentPage * pageSize, totalCount);
                    return `${start}–${end} of ${totalCount}`;
                  })()}
                </Text>
              </Group>

              {/* Page controls */}
              <Group gap="xs" align="center" wrap="nowrap" mt={10}>
                <ActionIcon
                  variant="default"
                  size="sm"
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <Text size="sm" ta="center" style={{ width: 26 }}>
                  {currentPage}
                </Text>
                <Text size="sm" c="dimmed">
                  of {Math.max(1, Math.ceil(totalCount / pageSize))}
                </Text>
                <ActionIcon
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const totalPages = Math.max(
                      1,
                      Math.ceil(totalCount / pageSize)
                    );
                    handlePageChange(Math.min(totalPages, currentPage + 1));
                  }}
                  disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </Group>
            </Group>
          </>
        )}
      </Card>
    </>
  );
}

export default PotentialCustomers;
