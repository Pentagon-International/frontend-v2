import { Route, Routes, Navigate } from "react-router-dom";
import RootLayout from "../layout/RootLayout";
import {
  CallModeEdit,
  CallModeMaster,
  CallModeView,
  GstnMaster,
  Dashboard,
  GroupCompany,
  GroupCompanyEdit,
  GroupCompanyView,
  MastersPage,
  NewCallMode,
  NewGroupCompany,
  TermsOfShipment,
  NewTermsOfShipment,
  EditTermsOfShipment,
  ViewTermsOfShipment,
  ContainerType,
  ContainerTypeEdit,
  ContainerTypeNew,
  ContainerTypeView,
  PortMaster,
  NewPortMaster,
  PortMasterEdit,
  PortMasterView,
  CompanyMaster,
  CompanyNew,
  CompanyEdit,
  CompanyView,
  CallEntry,
  CallEntryNew,
  CustomerType,
  CustomerTypeNew,
  CustomerTypeEdit,
  CustomerTypeView,
  FollowUpMaster,
  FollowUpMasterEdit,
  FollowUpMasterNew,
  FollowUpMasterView,
  FrequencyMaster,
  FrequencyMasterEdit,
  FrequencyMasterNew,
  FrequencyMasterView,
  BranchMaster,
  BranchMasterNew,
  BranchMasterEdit,
  BranchMasterView,
  ServiceMaster,
  ServiceMasterEdit,
  ServiceMasterNew,
  ServiceMasterView,
  QuotationCreate,
  PotentialCustomers,
  LeadList,
  CreateLead,
  UserMaster,
  UserCreate,
  TariffCreate,
  Freight,
  Origin,
  DestinationMaster,
  FreightCreate,
  DestinationCreate,
  CustomerMaster,
  CustomerCreate,
  CoordinatorReassignationMaster,
  CoordinatorReassignationCreate,
  CustomerRelationshipMappingMaster,
  CustomerRelationshipMappingCreate,
  ExportShipmentMaster,
  ExportShipmentCreate,
  ExportShipmentEdit,
  ImportShipmentMaster,
  ImportShipmentCreate,
  ImportShipmentEdit,
  ImportToExportBooking,
  SeaExportMaster,
  SeaExportCreate,
  ImportJobMaster,
  ImportJobCreate,
  HouseCreate,
  ExportJobMaster,
  ExportJobCreate,
  ExportHouseCreate,
  AirImportJobMaster,
  AirImportJobCreate,
  AirHouseCreate,
  AirExportJobMaster,
  AirExportJobCreate,
  AirExportHouseCreate,
  AirExportGenerationMaster,
  AirExportGenerationCreate,
  AirExportBookingMaster,
  AirExportBookingCreate,
  AirImportBookingMaster,
  AirImportBookingCreate,
  AirImportToExportBooking,
  FCLExportGenerationMaster,
  FCLExportGenerationCreate,
  LCLExportGenerationMaster,
  LCLExportGenerationCreate,
  OceanExportBookingMaster,
  OceanExportBookingCreate,
  OceanImportBookingMaster,
  OceanImportBookingCreate,
  OceanImportToExportBooking,
} from "../pages";
import Road from "../pages/dashboard/Road";
import DemoPage from "../pages/dashboard/DemoPage";
import EnquiryCreate from "../pages/dashboard/EnquiryCreate";
import GetRate from "../pages/dashboard/GetRate";
import EnquiryMaster from "../pages/dashboard/EnquiryMaster";
import QuotationMaster, {
  QuotationApprovalMaster,
} from "../pages/dashboard/QuotationMaster";
import { usePageTitleSync } from "../hooks/usePageTitle";
import TariffBulkUpload from "../pages/call-entry/TariffBulkUpload";
import OriginCreate from "../pages/call-entry/tariff/OriginCreate";
import Accounts from "../pages/dashboard/Accounts";
import CallEntryCalendar from "../pages/dashboard/CallEntryCalendar";
import Pipeline from "../pages/dashboard/Pipeline";
import PipelineCreate from "../pages/dashboard/PipelineCreate";
import useAuthStore from "../store/authStore";

const NavigationRoutes = () => {
  usePageTitleSync();
  const isStaff = useAuthStore((state) => state.user?.is_staff ?? false);

  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={isStaff ? <Dashboard /> : <Dashboard />} />
        <Route path="/road" element={<Road />} />
        <Route path="/air">
          <Route path="export-job">
            <Route index element={<AirExportJobMaster />} />
            <Route path="create" element={<AirExportJobCreate />} />
            <Route path="edit" element={<AirExportJobCreate />} />
            <Route path="view" element={<AirExportJobCreate />} />
            <Route path="house-create" element={<AirExportHouseCreate />} />
          </Route>
          <Route path="export-generation">
            <Route index element={<AirExportGenerationMaster />} />
            <Route path="create" element={<AirExportGenerationCreate />} />
          </Route>
          <Route path="export-booking">
            <Route index element={<AirExportBookingMaster />} />
            <Route path="create" element={<AirExportBookingCreate />} />
            <Route path="edit" element={<AirExportBookingCreate />} />
          </Route>
          <Route path="import-booking">
            <Route index element={<AirImportBookingMaster />} />
            <Route path="create" element={<AirImportBookingCreate />} />
            <Route path="edit" element={<AirImportBookingCreate />} />
          </Route>
          <Route
            path="import-to-export-booking"
            element={<AirImportToExportBooking />}
          />
          <Route path="import-job">
            <Route index element={<AirImportJobMaster />} />
            <Route path="create" element={<AirImportJobCreate />} />
            <Route path="edit" element={<AirImportJobCreate />} />
            <Route path="view" element={<AirImportJobCreate />} />
            <Route path="house-create" element={<AirHouseCreate />} />
          </Route>
        </Route>
        <Route path="/SeaExport">
          <Route
            index
            element={<Navigate to="/SeaExport/fcl-job-generation" replace />}
          />
          <Route path="fcl-job-generation">
            <Route index element={<SeaExportMaster />} />
            <Route path="create" element={<SeaExportCreate />} />
            <Route path="edit" element={<SeaExportCreate />} />
            <Route path="view" element={<SeaExportCreate />} />
          </Route>
          <Route path="lcl-job-generation">
            <Route index element={<SeaExportMaster />} />
            <Route path="create" element={<SeaExportCreate />} />
            <Route path="edit" element={<SeaExportCreate />} />
            <Route path="view" element={<SeaExportCreate />} />
          </Route>
          <Route path="fcl-export-generation">
            <Route index element={<FCLExportGenerationMaster />} />
            <Route path="create" element={<FCLExportGenerationCreate />} />
          </Route>
          <Route path="lcl-export-generation">
            <Route index element={<LCLExportGenerationMaster />} />
            <Route path="create" element={<LCLExportGenerationCreate />} />
          </Route>
          <Route path="export-booking">
            <Route index element={<OceanExportBookingMaster />} />
            <Route path="create" element={<OceanExportBookingCreate />} />
            <Route path="edit" element={<OceanExportBookingCreate />} />
          </Route>
          <Route path="import-booking">
            <Route index element={<OceanImportBookingMaster />} />
            <Route path="create" element={<OceanImportBookingCreate />} />
            <Route path="edit" element={<OceanImportBookingCreate />} />
          </Route>
          <Route
            path="import-to-export-booking"
            element={<OceanImportToExportBooking />}
          />
          <Route path="export-job">
            <Route index element={<ExportJobMaster />} />
            <Route path="create" element={<ExportJobCreate />} />
            <Route path="edit" element={<ExportJobCreate />} />
            <Route path="view" element={<ExportJobCreate />} />
            <Route path="house-create" element={<ExportHouseCreate />} />
          </Route>
          <Route path="import-job">
            <Route index element={<ImportJobMaster />} />
            <Route path="create" element={<ImportJobCreate />} />
            <Route path="edit" element={<ImportJobCreate />} />
            <Route path="view" element={<ImportJobCreate />} />
            <Route path="house-create" element={<HouseCreate />} />
          </Route>
        </Route>
        <Route path="/reports" element={<DemoPage />} />
        <Route path="/help" element={<DemoPage />} />
        <Route path="/collapse" element={<DemoPage />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/settings" element={<DemoPage />} />
        <Route path="/lead" element={<LeadList />} />
        <Route path="/lead-create" element={<CreateLead />} />
        <Route path="/call-entry" element={<CallEntry />} />
        <Route path="/call-entry-create" element={<CallEntryNew />} />
        <Route path="/call-entry-create/:id" element={<CallEntryNew />} />
        <Route path="/call-entry-calendar" element={<CallEntryCalendar />} />
        <Route path="/enquiry" element={<EnquiryMaster />} />
        <Route path="/enquiry-create" element={<EnquiryCreate />} />
        <Route path="/get-rate" element={<GetRate />} />
        <Route path="/quotation-create" element={<QuotationCreate />} />
        <Route path="/quotation-create/:id" element={<QuotationCreate />} />
        <Route
          path="/quotation-approval"
          element={<QuotationApprovalMaster />}
        />
        <Route
          path="/quotation"
          element={<QuotationMaster key="quotation-master" />}
        />
        <Route path="/potential-customers" element={<PotentialCustomers />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/pipeline/create" element={<PipelineCreate />} />
        <Route path="/customer-service">
          <Route path="export-shipment" element={<ExportShipmentMaster />}>
            <Route path="create" element={<ExportShipmentCreate />} />
            <Route path="edit" element={<ExportShipmentEdit />} />
          </Route>
          <Route path="import-shipment" element={<ImportShipmentMaster />}>
            <Route path="create" element={<ImportShipmentCreate />} />
            <Route path="edit" element={<ImportShipmentEdit />} />
          </Route>
          <Route
            path="import-to-export-booking"
            element={<ImportToExportBooking />}
          />
        </Route>
        <Route path="transportation">
          <Route path="sea-export" element={<SeaExportMaster />} />
          <Route path="sea-export/create" element={<SeaExportCreate />} />
        </Route>
        <Route
          path="tariff"
          //  element={<Tariff />}
        >
          <Route path="freight" element={<Freight />} />
          <Route path="freight/create" element={<FreightCreate />} />
          <Route path="origin" element={<Origin />} />
          <Route path="origin/create" element={<OriginCreate />} />
          <Route path="destination" element={<DestinationMaster />} />
          <Route path="destination/create" element={<DestinationCreate />} />
        </Route>
        <Route path="/tariff-create" element={<TariffCreate />} />
        <Route path="/tariff-bulk-upload" element={<TariffBulkUpload />} />
        <Route path="master" element={<MastersPage />}>
          <Route path="group-company" element={<GroupCompany />} />
          <Route path="group-company-new" element={<NewGroupCompany />} />
          <Route path="group-company-view" element={<GroupCompanyView />} />
          <Route path="group-company-edit" element={<GroupCompanyEdit />} />
          <Route path="company" element={<CompanyMaster />} />
          <Route path="company-new" element={<CompanyNew />} />
          <Route path="company-edit" element={<CompanyEdit />} />
          <Route path="company-view" element={<CompanyView />} />

          <Route path="call-mode" element={<CallModeMaster />} />
          <Route path="callmode-master-new" element={<NewCallMode />} />
          <Route path="callmode-master-edit" element={<CallModeEdit />} />
          <Route path="callmode-master-view" element={<CallModeView />} />
          <Route path="gstn" element={<GstnMaster />} />
          <Route path="terms-of-shipment" element={<TermsOfShipment />} />
          <Route
            path="terms-of-shipment-new"
            element={<NewTermsOfShipment />}
          />
          <Route
            path="terms-of-shipment-edit"
            element={<EditTermsOfShipment />}
          />
          <Route
            path="terms-of-shipment-view"
            element={<ViewTermsOfShipment />}
          />
          <Route path="container-type" element={<ContainerType />} />
          <Route path="container-type-new" element={<ContainerTypeNew />} />
          <Route path="container-type-edit" element={<ContainerTypeEdit />} />
          <Route path="container-type-view" element={<ContainerTypeView />} />

          <Route path="customer-type" element={<CustomerType />} />
          <Route path="customer-type-new" element={<CustomerTypeNew />} />
          <Route path="customer-type-edit" element={<CustomerTypeEdit />} />
          <Route path="customer-type-view" element={<CustomerTypeView />} />

          <Route path="follow-up" element={<FollowUpMaster />} />
          <Route path="follow-up-new" element={<FollowUpMasterNew />} />
          <Route path="follow-up-edit" element={<FollowUpMasterEdit />} />
          <Route path="follow-up-view" element={<FollowUpMasterView />} />

          <Route path="frequency" element={<FrequencyMaster />} />
          <Route path="frequency-new" element={<FrequencyMasterNew />} />
          <Route path="frequency-edit" element={<FrequencyMasterEdit />} />
          <Route path="frequency-view" element={<FrequencyMasterView />} />

          <Route path="branch" element={<BranchMaster />} />
          <Route path="branch-master-new" element={<BranchMasterNew />} />
          <Route path="branch-master-edit" element={<BranchMasterEdit />} />
          <Route path="branch-master-view" element={<BranchMasterView />} />

          <Route path="user" element={<UserMaster />} />
          <Route path="user-create" element={<UserCreate />} />

          <Route path="customer">
            <Route index element={<CustomerMaster />} />
            <Route path="create" element={<CustomerCreate />} />
            <Route path="edit/:id" element={<CustomerCreate />} />
            <Route path="view/:id" element={<CustomerCreate />} />
          </Route>

          <Route path="sales-co-ordinator-reassignation">
            <Route index element={<CoordinatorReassignationMaster />} />
            <Route path="create" element={<CoordinatorReassignationCreate />} />
            <Route
              path="edit/:id"
              element={<CoordinatorReassignationCreate />}
            />
          </Route>

          <Route path="customer-relationship-mapping">
            <Route index element={<CustomerRelationshipMappingMaster />} />
            <Route path="create" element={<CustomerRelationshipMappingCreate />} />
            <Route path="edit" element={<CustomerRelationshipMappingCreate />} />
          </Route>

          <Route path="service" element={<ServiceMaster />} />
          <Route path="service-new" element={<ServiceMasterNew />} />
          <Route path="service-edit" element={<ServiceMasterEdit />} />
          <Route path="service-view" element={<ServiceMasterView />} />

          <Route path="port" element={<PortMaster />} />
          <Route path="port-new" element={<NewPortMaster />} />
          <Route path="/master/port-edit" element={<PortMasterEdit />} />
          <Route path="/master/port-view" element={<PortMasterView />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default NavigationRoutes;
