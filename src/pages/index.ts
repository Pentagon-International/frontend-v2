import Login from "./auth/Login";
import Dashboard from "./dashboard/DashboardMaster";
import EnquiryConversionPage from "./dashboard/DashboardMaster/EnquiryConversion/EnquiryConversionPage";
import CallEntry from "./dashboard/CallEntryMaster";
import CallEntryNew from "./dashboard/CallEntryNew";
import QuotationCreate from "./dashboard/QuotationCreate";
import QuotationApprovalPublic from "./dashboard/QuotationApprovalPublic";
import GetRate from "./dashboard/GetRate";
import PotentialCustomers from "./dashboard/PotentialCustomers";
import LeadList from "./dashboard/LeadList";
import CreateLead from "./dashboard/CreateLead";
import ForgotPrimeId from "./auth/ForgotPrimeId";
import ForgotPassword from "./auth/ForgotPassword";
import ResetPassword from "./auth/ResetPassword";

import Tariff from "./call-entry/Tariff";
import TariffCreate from "./call-entry/TariffCreate";

// Group Company Master
import GroupCompany from "./masters/group_company/GroupCompany";
import GroupCompanyEdit from "./masters/group_company/GroupCompanyEdit";
import GroupCompanyView from "./masters/group_company/GroupCompanyView";
import NewGroupCompany from "./masters/group_company/NewGroupCompany";

// Call Mode Master
import CallModeMaster from "../pages/masters/callmode-master/CallModeMaster";
import NewCallMode from "../pages/masters/callmode-master/NewCallMode";
import CallModeEdit from "../pages/masters/callmode-master/CallModeEdit";
import CallModeView from "../pages/masters/callmode-master/CallModeView";

// Create Customer-PAN Master
import CustomerPanMaster from "../pages/masters/customer-pan-master/CustomerPanMaster";

import MastersPage from "./masters/MastersPage";

import CompanyMaster from "./masters/company/CompanyMaster";
import CompanyNew from "./masters/company/CompanyNew";
import CompanyEdit from "./masters/company/CompanyEdit";
import CompanyView from "./masters/company/CompanyView";

// Terms of Shipment Master
import TermsOfShipment from "../pages/masters/termsofshipment/TermsOfShipment";
import NewTermsOfShipment from "../pages/masters/termsofshipment/NewTermsOfShipment";
import EditTermsOfShipment from "../pages/masters/termsofshipment/EditTermsOfShipment";
import ViewTermsOfShipment from "../pages/masters/termsofshipment/ViewTermsOfShipment";

import ContainerType from "./masters/containertype/ContainerTypeMaster";
import ContainerTypeNew from "../pages/masters/containertype/ContainerTypeNew";
import ContainerTypeEdit from "../pages/masters/containertype/ContainerTypeEdit";
import ContainerTypeView from "../pages/masters/containertype/ContainerTypeView";

import PortMaster from "../pages/masters/portmaster/PortMaster";
import NewPortMaster from "../pages/masters/portmaster/NewPortMaster";
import PortMasterEdit from "../pages/masters/portmaster/PortMasterEdit";
import PortMasterView from "../pages/masters/portmaster/PortMasterView";

import CustomerType from "./masters/customertype/CustomerTypeMaster";
import CustomerTypeNew from "./masters/customertype/CustomerTypeNew";
import CustomerTypeEdit from "./masters/customertype/CustomerTypeEdit";
import CustomerTypeView from "./masters/customertype/CustomerTypeView";

import FollowUpMaster from "./masters/follow-up-master/FollowUpMaster";
import FollowUpMasterNew from "./masters/follow-up-master/FollowUpMasterNew";
import FollowUpMasterEdit from "./masters/follow-up-master/FollowUpMasterEdit";
import FollowUpMasterView from "./masters/follow-up-master/FollowUpMasterView";

import FrequencyMaster from "./masters/frequency-master/FrequencyMaster";
import FrequencyMasterNew from "./masters/frequency-master/FrequencyMasterNew";
import FrequencyMasterEdit from "./masters/frequency-master/FrequencyMasterEdit";
import FrequencyMasterView from "./masters/frequency-master/FrequencyMasterView";

import BranchMaster from "../pages/masters/branch-master/BranchMaster";
import BranchMasterNew from "../pages/masters/branch-master/BranchMasterNew";
import BranchMasterEdit from "../pages/masters/branch-master/BranchMasterEdit";
import BranchMasterView from "../pages/masters/branch-master/BranchMasterView";

import UserMaster from "./masters/user/UserMaster";
import UserCreate from "./masters/user/UserCreate";

import CustomerMaster from "./masters/customer-addressMapping/CustomerMaster";
import CustomerCreate from "./masters/customer-addressMapping/CustomerCreate";
import VendorMaster from "./masters/vendor/VendorMaster";
import CoordinatorReassignationMaster from "./masters/coordinator-reassignation/CoordinatorReassignationMaster";
import CoordinatorReassignationCreate from "./masters/coordinator-reassignation/CoordinatorReassignationCreate";
import CustomerRelationshipMappingMaster from "./masters/customer-relationship-mapping/CustomerRelationshipMappingMaster";
import CustomerRelationshipMappingCreate from "./masters/customer-relationship-mapping/CustomerRelationshipMappingCreate";

import ExportShipmentCreate from "./customer-service/ExportShipmentCreate";
import ExportShipmentMaster from "./customer-service/ExportShipmentMaster";
import ExportShipmentEdit from "./customer-service/ExportShipmentEdit";
import ImportShipmentMaster from "./customer-service/ImportShipmentMaster";
import ImportShipmentCreate from "./customer-service/ImportShipmentCreate";
import ImportShipmentEdit from "./customer-service/ImportShipmentEdit";
import ImportToExportBooking from "./customer-service/ImportToExportBooking";
import Pipeline from "./dashboard/Pipeline";
import PipelineCreate from "./dashboard/PipelineCreate";

// Transportation - Ocean Job Generation (formerly Sea Export)
import OceanJobGenerationMaster from "./Ocean/JobGeneration/OceanJobGenerationMaster";
import OceanJobGenerationCreate from "./Ocean/JobGeneration/OceanJobGenerationCreate";
import ImportJobMaster from "./Transportation/ImportJob";
import ImportJobCreate from "./Transportation/ImportJob/ImportJobCreate";
import HouseCreate from "./Transportation/ImportJob/HouseCreate";
import ExportJobMaster from "./Transportation/ExportJob";
import ExportJobCreate from "./Transportation/ExportJob/ExportJobCreate";
import ExportHouseCreate from "./Transportation/ExportJob/HouseCreate";
import AirImportJobMaster from "./Transportation/AirImportJob";
import AirImportJobCreate from "./Transportation/AirImportJob/AirImportJobCreate";
import AirHouseCreate from "./Transportation/AirImportJob/AirHouseCreate";
import InvoiceCreate from "./Transportation/Invoice/InvoiceCreate";
import InvoiceReverse from "./Transportation/Invoice/InvoiceReverse";
import PaymentRequestCreate from "./Transportation/PaymentRequest/PaymentRequest";
import PaymentRequestApproval from "./Transportation/PaymentRequest/PaymentRequestApproval";
import AirExportJobMaster from "./Transportation/AirExportJob";
import AirExportJobCreate from "./Transportation/AirExportJob/AirExportJobCreate";
import AirExportHouseCreate from "./Transportation/AirExportJob/AirHouseCreate";

// Air Module - Customer Service
import AirExportGenerationMaster from "./Air/ExportGeneration/AirExportGenerationMaster";
import AirExportGenerationCreate from "./Air/ExportGeneration/AirExportGenerationCreate";
import AirJobGenerationMaster from "./Air/JobGeneration/AirJobGenerationMaster";
import AirJobGenerationCreate from "./Air/JobGeneration/AirJobGenerationCreate";
import AirExportBookingMaster from "./Air/ExportBooking/AirExportBookingMaster";
import AirExportBookingCreate from "./Air/ExportBooking/AirExportBookingCreate";
import AirImportBookingMaster from "./Air/ImportBooking/AirImportBookingMaster";
import AirImportBookingCreate from "./Air/ImportBooking/AirImportBookingCreate";
import AirImportToExportBooking from "./Air/ImportToExportBooking";

// Ocean Module - Customer Service
import FCLExportGenerationMaster from "./Ocean/ExportGeneration/FCL/FCLExportGenerationMaster";
import FCLExportGenerationCreate from "./Ocean/ExportGeneration/FCL/FCLExportGenerationCreate";
import LCLExportGenerationMaster from "./Ocean/ExportGeneration/LCL/LCLExportGenerationMaster";
import LCLExportGenerationCreate from "./Ocean/ExportGeneration/LCL/LCLExportGenerationCreate";
import OceanExportBookingMaster from "./Ocean/ExportBooking/OceanExportBookingMaster";
import OceanExportBookingCreate from "./Ocean/ExportBooking/OceanExportBookingCreate";
import OceanImportBookingMaster from "./Ocean/ImportBooking/OceanImportBookingMaster";
import OceanImportBookingCreate from "./Ocean/ImportBooking/OceanImportBookingCreate";
import OceanImportToExportBooking from "./Ocean/ImportToExportBooking";

import ServiceMaster from "../pages/masters/service-master/ServiceMaster";
import ServiceMasterNew from "../pages/masters/service-master/ServiceMasterNew";
import ServiceMasterEdit from "../pages/masters/service-master/ServiceMasterEdit";
import ServiceMasterView from "../pages/masters/service-master/ServiceMasterView";

// Accounts Masters
import ChargeMaster from "./masters/charge/ChargeMaster";
import ChargeCreate from "./masters/charge/ChargeCreate";
import TdsSectionMaster from "./masters/tds-section/TdsSectionMaster";
import TdsSectionCreate from "./masters/tds-section/TdsSectionCreate";
import TdsRateSectionMaster from "./masters/tds-rate-section/TdsRateSectionMaster";
import TdsRateSectionCreate from "./masters/tds-rate-section/TdsRateSectionCreate";
import NetworkMaster from "./masters/network-master/NetworkMaster";
import NetworkCreate from "./masters/network-master/NetworkCreate";
import ChartOfAccountsMaster from "./masters/chart-of-accounts/ChartOfAccountsMaster";
import ChartOfAccountsCreate from "./masters/chart-of-accounts/ChartOfAccountsCreate";
import GLChargeMappingMaster from "./masters/gl-charge-mapping/GLChargeMappingMaster";
import GLChargeMappingCreate from "./masters/gl-charge-mapping/GLChargeMappingCreate";
import GSTSACMaster from "./masters/gst-sac/GSTSACMaster";
import GSTSACCreate from "./masters/gst-sac/GSTSACCreate";
import GSTRateMaster from "./masters/gst-rate/GSTRateMaster";
import GSTChargeMappingMaster from "./masters/gst-charge-mapping/GSTChargeMappingMaster";
import GSTChargeMappingCreate from "./masters/gst-charge-mapping/GSTChargeMappingCreate";
import CFSMaster from "./masters/cfs/CFSMaster";
import CFSCreate from "./masters/cfs/CFSCreate";

import Freight from "./call-entry/tariff/FreightMaster";
import TariffContractsList from "./call-entry/tariff/TariffContractsList";
import TariffContractsListRoute from "./call-entry/tariff/TariffContractsListRoute";
import TariffContractsDetail from "./call-entry/tariff/TariffContractsDetail";
import CreateContract from "./call-entry/tariff/CreateContract";
import DestinationMaster from "./call-entry/tariff/DestinationMaster";
import Origin from "./call-entry/tariff/OriginMaster";
import FreightCreate from "./call-entry/tariff/FreightCreate";
import DestinationCreate from "./call-entry/tariff/DestinationCreate";
import HBLDocumentManager from "./Workflow/jobcreation/AutoJobCreation"
import Invoice from "./Workflow/jobcreation/InvoiceCreation";
import Chatbot from "./Workflow/Chatbot";
import ChatbotGoogleApi from "./Workflow/Chatbot_google_api";
import ChatbotBrowser from "./Workflow/Chatbot_browser";
export {
  Login,
  Dashboard,
  EnquiryConversionPage,
  CallEntry,
  CallEntryNew,
  LeadList,
  CreateLead,
  ForgotPrimeId,
  ForgotPassword,
  ResetPassword,
  MastersPage,
  GroupCompany,
  GroupCompanyEdit,
  GroupCompanyView,
  NewGroupCompany,
  CompanyMaster,
  CompanyNew,
  CompanyEdit,
  CompanyView,
  CallModeMaster,
  NewCallMode,
  CallModeEdit,
  CallModeView,
  CustomerPanMaster,
  TermsOfShipment,
  NewTermsOfShipment,
  EditTermsOfShipment,
  ViewTermsOfShipment,
  ContainerType,
  ContainerTypeNew,
  ContainerTypeEdit,
  ContainerTypeView,
  PortMaster,
  NewPortMaster,
  PortMasterEdit,
  PortMasterView,
  CustomerType,
  CustomerTypeNew,
  CustomerTypeEdit,
  CustomerTypeView,
  FollowUpMaster,
  FollowUpMasterNew,
  FollowUpMasterEdit,
  FollowUpMasterView,
  FrequencyMaster,
  FrequencyMasterNew,
  FrequencyMasterEdit,
  FrequencyMasterView,
  BranchMaster,
  BranchMasterNew,
  BranchMasterEdit,
  BranchMasterView,
  UserMaster,
  UserCreate,
  CustomerMaster,
  CustomerCreate,
  VendorMaster,
  CoordinatorReassignationMaster,
  CoordinatorReassignationCreate,
  CustomerRelationshipMappingMaster,
  CustomerRelationshipMappingCreate,
  ServiceMaster,
  ServiceMasterNew,
  ServiceMasterEdit,
  ServiceMasterView,
  ChargeMaster,
  ChargeCreate,
  TdsSectionMaster,
  TdsSectionCreate,
  TdsRateSectionMaster,
  TdsRateSectionCreate,
  NetworkMaster,
  NetworkCreate,
  ChartOfAccountsMaster,
  ChartOfAccountsCreate,
  GLChargeMappingMaster,
  GLChargeMappingCreate,
  GSTSACMaster,
  GSTSACCreate,
  GSTRateMaster,
  GSTChargeMappingMaster,
  GSTChargeMappingCreate,
  CFSMaster,
  CFSCreate,
  QuotationCreate,
  QuotationApprovalPublic,
  GetRate,
  PotentialCustomers,
  Tariff,
  TariffCreate,
  Freight,
  TariffContractsList,
  TariffContractsListRoute,
  TariffContractsDetail,
  CreateContract,
  DestinationMaster,
  Origin,
  FreightCreate,
  DestinationCreate,
  ExportShipmentMaster,
  ExportShipmentCreate,
  ExportShipmentEdit,
  ImportShipmentMaster,
  ImportShipmentCreate,
  ImportShipmentEdit,
  ImportToExportBooking,
  Pipeline,
  PipelineCreate,
  OceanJobGenerationMaster,
  OceanJobGenerationCreate,
  ImportJobMaster,
  ImportJobCreate,
  HouseCreate,
  ExportJobMaster,
  ExportJobCreate,
  ExportHouseCreate,
  AirImportJobMaster,
  AirImportJobCreate,
  AirHouseCreate,
  InvoiceCreate,
  InvoiceReverse,
  PaymentRequestCreate,
  PaymentRequestApproval,
  AirExportJobMaster,
  AirExportJobCreate,
  AirExportHouseCreate,
  // Air Module - Customer Service
  AirExportGenerationMaster,
  AirExportGenerationCreate,
  AirJobGenerationMaster,
  AirJobGenerationCreate,
  AirExportBookingMaster,
  AirExportBookingCreate,
  AirImportBookingMaster,
  AirImportBookingCreate,
  AirImportToExportBooking,
  // Ocean Module - Customer Service
  FCLExportGenerationMaster,
  FCLExportGenerationCreate,
  LCLExportGenerationMaster,
  LCLExportGenerationCreate,
  OceanExportBookingMaster,
  OceanExportBookingCreate,
  OceanImportBookingMaster,
  OceanImportBookingCreate,
  OceanImportToExportBooking,
  HBLDocumentManager,
  Invoice,
  Chatbot,
  ChatbotGoogleApi,
  ChatbotBrowser,
};
