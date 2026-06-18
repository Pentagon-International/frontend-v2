import { Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import RootLayout from "../layout/RootLayout";
import OdexLegacyJobRedirect from "./OdexLegacyJobRedirect";
import {
  CallModeEdit,
  CallModeMaster,
  CallModeView,
  CustomerPanMaster,
  ApproveCustomerPanMaster,
  Dashboard,
  EnquiryConversionPage,
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
  PortCreate,
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
  QuotationCreatePage,
  PotentialCustomers,
  LeadList,
  CreateLead,
  UserMaster,
  UserCreate,
  TariffCreate,
  Freight,
  TariffContractsListRoute,
  TariffContractsDetail,
  CreateContract,
  Origin,
  DestinationMaster,
  FreightCreate,
  DestinationCreate,
  CustomerMaster,
  CustomerCreate,
  VendorMaster,
  CoordinatorReassignationMaster,
  CoordinatorReassignationCreate,
  CustomerRelationshipMappingMaster,
  CustomerRelationshipMappingCreate,
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
  ExportShipmentMaster,
  ExportShipmentCreate,
  ExportShipmentEdit,
  ImportShipmentMaster,
  ImportShipmentCreate,
  ImportShipmentEdit,
  ImportToExportBooking,
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
  AirExportGenerationMaster,
  AirExportGenerationCreate,
  AirJobGenerationMaster,
  AirJobGenerationCreate,
  AirExportBookingMaster,
  AirExportBookingCreate,
  InlandExportJobMaster,
  InlandExportJobCreate,
  InlandExportHouseCreate,
  InlandImportJobMaster,
  InlandImportJobCreate,
  InlandImportHouseCreate,
  InlandExportJobGenerationMaster,
  InlandExportJobGenerationCreate,
  InlandExportBookingMaster,
  InlandExportBookingCreate,
  InlandImportBookingMaster,
  InlandImportBookingCreate,
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
  HBLDocumentManager,
  Invoice,
  OdexJobsMaster,
  OdexJobDetail,
  Chatbot,
  ChatbotGoogleApi,
  ChatbotBrowser,
} from "../pages";
import Road from "../pages/dashboard/Road";
import DemoPage from "../pages/dashboard/DemoPage";
import EnquiryCreate from "../pages/dashboard/EnquiryCreate";
import GetRate from "../pages/dashboard/GetRate";
import EnquiryMaster from "../pages/dashboard/EnquiryMaster";
import RFQMaster from "../pages/dashboard/RFQ/RFQMaster";
import RFQCreate from "../pages/dashboard/RFQ/RFQCreate";
import LastEnquiriesList from "../pages/dashboard/LastEnquiriesList";
import ReceiptMaster from "../pages/accounts/receipt/ReceiptMaster";
import ReceiptCreate from "../pages/accounts/receipt/ReceiptCreate";
import ReceiptReversal from "../pages/accounts/reverse-receipt/ReceiptReversal";
import ReceiptReversalMaster from "../pages/accounts/reverse-receipt/ReceiptReversalMaster";
import OverseasReceiptMaster from "../pages/accounts/overseas-receipt/OverseasReceiptMaster";
import OverseasReceiptCreate from "../pages/accounts/overseas-receipt/OverseasReceiptCreate";
import PaymentMaster from "../pages/accounts/payment/PaymentMaster";
import PaymentCreate from "../pages/accounts/payment/PaymentCreate";
import PaymentReversal from "../pages/accounts/reverse-payment/PaymentReversal";
import PaymentReversalMaster from "../pages/accounts/reverse-payment/PaymentReversalMaster";
import SupplierInvoiceMaster from "../pages/accounts/supplier-invoice/SupplierInvoiceMaster";
import UnpostedDocumentsList from "../pages/accounts/invoices/UnpostedDocumentsList";
import SupplierInvoiceCreate from "../pages/accounts/supplier-invoice/SupplierInvoiceCreate";
import SupplierInvoiceReversal from "../pages/accounts/supplier-invoice/SupplierInvoiceReversal";
import SupplierInvoiceReversalMaster from "../pages/accounts/supplier-invoice/SupplierInvoiceReversalMaster";
import SupplierInvoiceRCMMaster from "../pages/accounts/supplier-invoice-RCM/SupplierInvoiceRCMMaster";
import SupplierInvoiceRCMCreate from "../pages/accounts/supplier-invoice-RCM/SupplierInvoiceRCMCreate";
import JournalVoucher from "../pages/accounts/journalVoucher/JournalVoucher";
import JournalVoucherMaster from "../pages/accounts/journalVoucher/JournalVoucherMaster";
import JournalVoucherReversal from "../pages/accounts/journalVoucherReversal/JournalVoucherReversal";
import JournalVoucherReversalMaster from "../pages/accounts/journalVoucherReversal/JournalVoucherReversalMaster";
import QuotationMaster, {
  QuotationApprovalMaster,
} from "../pages/dashboard/QuotationMaster";
import OverseasPaymentMaster from "../pages/accounts/overseasPayment/OverseasPaymentMaster";
import OverseasPaymentCreate from "../pages/accounts/overseasPayment/OverseasPaymentCreate";
import JobLedger from "../pages/Transportation/JobLedger/JobLedger";
import { usePageTitleSync } from "../hooks/usePageTitle";
import TariffBulkUpload from "../pages/call-entry/TariffBulkUpload";
import OriginCreate from "../pages/call-entry/tariff/OriginCreate";
import Accounts from "../pages/dashboard/Accounts";
import CallEntryCalendar from "../pages/dashboard/CallEntryCalendar";
import Pipeline from "../pages/dashboard/Pipeline";
import PipelineCreate from "../pages/dashboard/PipelineCreate";
import useAuthStore from "../store/authStore";
import SubledgerEnquiry from "../pages/accounts/subledger-enquiry/SubledgerEnquiry";
import DocumentAllocation from "../pages/accounts/document-allocation/DocumentAllocation";
import DocumentAllocationList from "../pages/accounts/document-allocation/DocumentAllocationList";
import DebitCreditNoteNonTradeMaster from "../pages/accounts/debit-credit-note-non-trade/DebitCreditNoteNonTradeMaster";
import DebitCreditNoteNonTradeCreate from "../pages/accounts/debit-credit-note-non-trade/DebitCreditNoteNonTradeCreate";
import DebitCreditNoteTradeMaster from "../pages/accounts/debit-credit-note-trade/DebitCreditNoteTradeMaster";
import DebitCreditNoteTradeCreate from "../pages/accounts/debit-credit-note-trade/DebitCreditNoteTradeCreate";
import JobProfit from "../pages/reports/JobProfit/JobProfit";
import TrialBalance from "../pages/reports/trialBalance/TrailBalance";
import AgingOutstanding from "../pages/reports/agingOutstanding/AgingOutstanding";
import ReportsPage from "../pages/reports/ReportsPage";
import SubledgerOutstanding from "../pages/reports/subledgerOutsyanding/SubledgerOutstanding";
import PurchaseRegister from "../pages/reports/purchaseRegister/PurchaseRegister";
import CallEntryDashboardPage from "../pages/dashboard/DashboardMaster/CallEntryDashboard";
import CustomerOutstandingVsOverdueDashboard from "../pages/dashboard/DashboardMaster/CustomerOutstandingVsOverdueDashboard";
import BudgetVsActualDashboard from "../pages/dashboard/DashboardMaster/BudgetVsActualDashboard";
import FinanceDashboardPage from "../pages/dashboard/DashboardMaster/FinanceDashboardPage";
import FinanceDashboardBranchBudgetPage from "../pages/dashboard/DashboardMaster/FinanceDashboardBranchBudgetPage";
import FinanceDashboardCollectionPage from "../pages/dashboard/DashboardMaster/FinanceDashboardCollectionPage";
import FinanceDashboardOutstandingPage from "../pages/dashboard/DashboardMaster/FinanceDashboardOutstandingPage";
import FinanceDashboardPendingPage from "../pages/dashboard/DashboardMaster/FinanceDashboardPendingPage";
import AirImportDsr from "../pages/Air/AirImportDsr";
import AirExportDsr from "../pages/Air/AirExportDsr";
import OceanImportDsr from "../pages/Ocean/OceanImportDsr";
import OceanExportDsr from "../pages/Ocean/OceanExportDsr";

function NavigateKeepSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}

const NavigationRoutes = () => {
  usePageTitleSync();
  const isStaff = useAuthStore((state) => state.user?.is_staff ?? false);

  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={isStaff ? <Dashboard /> : <Dashboard />} />
        <Route
          path="/dashboard/enquiry-conversion"
          element={<EnquiryConversionPage />}
        />
        <Route
          path="/dashboard/call-entry-dashboard"
          element={<CallEntryDashboardPage />}
        />
        <Route
          path="/dashboard/customer-outstanding-vs-overdue"
          element={<CustomerOutstandingVsOverdueDashboard />}
        />
        <Route
          path="/dashboard/budget-vs-actual"
          element={<BudgetVsActualDashboard />}
        />
        <Route
          path="/finance-dashboard/profitability"
          element={<FinanceDashboardPage />}
        />
        <Route
          path="/finance-dashboard/branch-budget-vs-actual"
          element={<FinanceDashboardBranchBudgetPage />}
        />
        <Route
          path="/finance-dashboard/collection-target-vs-performance"
          element={<FinanceDashboardCollectionPage />}
        />
        <Route
          path="/finance-dashboard/outstanding-ageing"
          element={<FinanceDashboardOutstandingPage />}
        />
        <Route
          path="/finance-dashboard/pending-activities"
          element={<FinanceDashboardPendingPage />}
        />
        <Route path="/road" element={<Road />} />
        <Route path="/inland">
          <Route path="export-job">
            <Route index element={<InlandExportJobMaster />} />
            <Route path="create" element={<InlandExportJobCreate />} />
            <Route path="edit" element={<InlandExportJobCreate />} />
            <Route path="view" element={<InlandExportJobCreate />} />
            <Route path="house-create" element={<InlandExportHouseCreate />} />
            <Route path="invoice" element={<InvoiceCreate />} />
            <Route path="invoice/edit/:id" element={<InvoiceCreate />} />
            <Route path="invoice/view/:id" element={<InvoiceCreate />} />
            <Route path="credit-note" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="credit-note/edit/:id" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="credit-note/view/:id" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="invoice/reverse" element={<InvoiceReverse />} />
          </Route>
          <Route path="import-job">
            <Route index element={<InlandImportJobMaster />} />
            <Route path="create" element={<InlandImportJobCreate />} />
            <Route path="edit" element={<InlandImportJobCreate />} />
            <Route path="view" element={<InlandImportJobCreate />} />
            <Route path="house-create" element={<InlandImportHouseCreate />} />
            <Route path="invoice" element={<InvoiceCreate />} />
            <Route path="invoice/edit/:id" element={<InvoiceCreate />} />
            <Route path="invoice/view/:id" element={<InvoiceCreate />} />
            <Route path="credit-note" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="credit-note/edit/:id" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="credit-note/view/:id" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="invoice/reverse" element={<InvoiceReverse />} />
          </Route>
          <Route path="export-job-generation">
            <Route index element={<InlandExportJobGenerationMaster />} />
            <Route path="create" element={<InlandExportJobGenerationCreate />} />
            <Route path="edit" element={<InlandExportJobGenerationCreate />} />
            <Route path="view" element={<InlandExportJobGenerationCreate />} />
          </Route>
          <Route path="job-generation">
            <Route index element={<InlandExportJobGenerationMaster />} />
            <Route path="create" element={<InlandExportJobGenerationCreate />} />
            <Route path="edit" element={<InlandExportJobGenerationCreate />} />
            <Route path="view" element={<InlandExportJobGenerationCreate />} />
          </Route>
          <Route path="export-booking">
            <Route index element={<InlandExportBookingMaster />} />
            <Route path="create" element={<InlandExportBookingCreate />} />
            <Route path="edit" element={<InlandExportBookingCreate />} />
          </Route>
          <Route path="import-booking">
            <Route index element={<InlandImportBookingMaster />} />
            <Route path="create" element={<InlandImportBookingCreate />} />
            <Route path="edit" element={<InlandImportBookingCreate />} />
          </Route>
        </Route>
        <Route path="/air">
          <Route path="import-dsr" element={<AirImportDsr />} />
          <Route path="export-dsr" element={<AirExportDsr />} />
          <Route path="export-job">
            <Route index element={<AirExportJobMaster />} />
            <Route path="create" element={<AirExportJobCreate />} />
            <Route path="edit" element={<AirExportJobCreate />} />
            <Route path="view" element={<AirExportJobCreate />} />
            <Route path="house-create" element={<AirExportHouseCreate />} />
            <Route path="invoice" element={<InvoiceCreate />} />
            <Route path="invoice/edit/:id" element={<InvoiceCreate />} />
            <Route path="invoice/view/:id" element={<InvoiceCreate />} />
            <Route path="credit-note" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="credit-note/edit/:id" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="credit-note/view/:id" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="invoice/reverse" element={<InvoiceReverse />} />
          </Route>
          <Route path="export-generation">
            <Route index element={<AirExportGenerationMaster />} />
            <Route path="create" element={<AirExportGenerationCreate />} />
          </Route>
          <Route path="job-generation">
            <Route index element={<AirJobGenerationMaster />} />
            <Route path="create" element={<AirJobGenerationCreate />} />
            <Route path="edit" element={<AirJobGenerationCreate />} />
            <Route path="view" element={<AirJobGenerationCreate />} />
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
            <Route path="invoice" element={<InvoiceCreate />} />
            <Route path="invoice/edit/:id" element={<InvoiceCreate />} />
            <Route path="invoice/view/:id" element={<InvoiceCreate />} />
            <Route path="credit-note" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="credit-note/edit/:id" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="credit-note/view/:id" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="invoice/reverse" element={<InvoiceReverse />} />
          </Route>
        </Route>
        <Route path="/SeaExport">
          <Route
            index
            element={<Navigate to="/SeaExport/fcl-job-generation" replace />}
          />
          <Route path="fcl-job-generation">
            <Route index element={<OceanJobGenerationMaster />} />
            <Route path="create" element={<OceanJobGenerationCreate />} />
            <Route path="edit" element={<OceanJobGenerationCreate />} />
            <Route path="view" element={<OceanJobGenerationCreate />} />
          </Route>
          <Route path="lcl-job-generation">
            <Route index element={<OceanJobGenerationMaster />} />
            <Route path="create" element={<OceanJobGenerationCreate />} />
            <Route path="edit" element={<OceanJobGenerationCreate />} />
            <Route path="view" element={<OceanJobGenerationCreate />} />
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
          <Route path="import-dsr" element={<OceanImportDsr />} />
          <Route path="export-dsr" element={<OceanExportDsr />} />
          <Route path="export-job">
            <Route index element={<ExportJobMaster />} />
            <Route path="create" element={<ExportJobCreate />} />
            <Route path="edit" element={<ExportJobCreate />} />
            <Route path="view" element={<ExportJobCreate />} />
            <Route path="house-create" element={<ExportHouseCreate />} />
            <Route path="invoice" element={<InvoiceCreate />} />
            <Route path="invoice/edit/:id" element={<InvoiceCreate />} />
            <Route path="invoice/view/:id" element={<InvoiceCreate />} />
            <Route path="credit-note" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="credit-note/edit/:id" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="credit-note/view/:id" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="invoice/reverse" element={<InvoiceReverse />} />
          </Route>
          <Route path="import-job">
            <Route index element={<ImportJobMaster />} />
            <Route path="create" element={<ImportJobCreate />} />
            <Route path="edit" element={<ImportJobCreate />} />
            <Route path="view" element={<ImportJobCreate />} />
            <Route path="house-create" element={<HouseCreate />} />
            <Route path="invoice" element={<InvoiceCreate />} />
            <Route path="invoice/edit/:id" element={<InvoiceCreate />} />
            <Route path="invoice/view/:id" element={<InvoiceCreate />} />
            <Route path="credit-note" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="credit-note/edit/:id" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="credit-note/view/:id" element={<InvoiceCreate documentType="CRN" baseDrCr="Cr" chargeDefaultDrCr="Dr" documentLabel="Credit Note" />} />
            <Route path="invoice/reverse" element={<InvoiceReverse />} />
          </Route>
        </Route>
        <Route path="/reports">
          <Route index element={<ReportsPage />} />
          <Route path="job-profit" element={<JobProfit />} />
          <Route path="trial-balance" element={<TrialBalance />} />
          <Route path="aging-outstanding" element={<AgingOutstanding />} />
          <Route path="subledger-outstanding" element={<SubledgerOutstanding />} />
          <Route path="purchase-register" element={<PurchaseRegister />} />
        </Route>
        <Route path="/help" element={<DemoPage />} />
        <Route path="/collapse" element={<DemoPage />} />
        <Route path="/job-ledger" element={<JobLedger />} />
        {/* Generic invoice routes (shared component across modules) */}
        <Route path="/invoice" element={<InvoiceCreate />} />
        <Route path="/invoice/edit/:id" element={<InvoiceCreate />} />
        <Route path="/invoice/view/:id" element={<InvoiceCreate />} />
        <Route path="/invoice-reverse" element={<InvoiceReverse />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/receipt" element={<ReceiptMaster />} />
        <Route path="/receipt/view" element={<ReceiptCreate />} />
        <Route path="/receipt/edit" element={<ReceiptCreate />} />
        <Route path="/receipt/create" element={<ReceiptCreate />} />
        <Route path="/receipt/reversal" element={<ReceiptReversalMaster />} />
        <Route path="/receipt/reversal/view" element={<ReceiptReversal />} />
        <Route path="/receipt/reversal/edit" element={<ReceiptReversal />} />
        <Route path="/receipt/reversal/create" element={<ReceiptReversal />} />
        <Route path="/overseas-receipt" element={<OverseasReceiptMaster />} />
        <Route path="/overseas-receipt/view" element={<OverseasReceiptCreate />} />
        <Route path="/overseas-receipt/edit" element={<OverseasReceiptCreate />} />
        <Route path="/overseas-receipt/create" element={<OverseasReceiptCreate />} />
        <Route path="/overseas-receipt/reversal/create" element={<OverseasReceiptCreate isReversal />} />
        <Route path="/overseas-receipt/reversal/edit" element={<OverseasReceiptCreate isReversal />} />
        <Route path="/overseas-receipt/reversal/view" element={<OverseasReceiptCreate isReversal />} />
        <Route path="/payment" element={<PaymentMaster />} />
        <Route path="/payment/view" element={<PaymentCreate />} />
        <Route path="/payment/edit" element={<PaymentCreate />} />
        <Route path="/payment/create" element={<PaymentCreate />} />
        <Route path="/payment/reversal" element={<PaymentReversalMaster />} />
        <Route path="/payment/reversal/view" element={<PaymentReversal />} />
        <Route path="/payment/reversal/edit" element={<PaymentReversal />} />
        <Route path="/payment/reversal/create" element={<PaymentReversal />} />
        <Route path="/overseas-payment" element={<OverseasPaymentMaster />} />
        <Route path="/overseas-payment/view" element={<OverseasPaymentCreate />} />
        <Route path="/overseas-payment/edit" element={<OverseasPaymentCreate />} />
        <Route path="/overseas-payment/create" element={<OverseasPaymentCreate />} />
        <Route
          path="/overseas-payment/reversal/create"
          element={<OverseasPaymentCreate isReversal />}
        />
        <Route
          path="/overseas-payment/reversal/edit"
          element={<OverseasPaymentCreate isReversal />}
        />
        <Route
          path="/overseas-payment/reversal/view"
          element={<OverseasPaymentCreate isReversal />}
        />
        <Route path="/unposted-documents" element={<UnpostedDocumentsList />} />
        <Route path="/invoices" element={<Navigate to="/unposted-documents" replace />} />
        <Route path="/supplier-invoice" element={<SupplierInvoiceMaster />} />
        <Route path="/supplier-invoice/create" element={<SupplierInvoiceCreate />} />
        <Route path="/supplier-invoice/view/:id" element={<SupplierInvoiceCreate />} />
        <Route path="/supplier-invoice/edit/:id" element={<SupplierInvoiceCreate />} />
        <Route path="/supplier-invoice/view" element={<SupplierInvoiceCreate />} />
        <Route path="/supplier-invoice/edit" element={<SupplierInvoiceCreate />} />
        <Route path="/supplier-invoice-rcm" element={<SupplierInvoiceRCMMaster />} />
        <Route path="/supplier-invoice-rcm/create" element={<SupplierInvoiceRCMCreate />} />
        <Route path="/supplier-invoice-rcm/view" element={<SupplierInvoiceRCMCreate />} />
        <Route path="/supplier-invoice-rcm/edit" element={<SupplierInvoiceRCMCreate />} />
        <Route path="/supplier-invoice/reversal" element={<SupplierInvoiceReversalMaster />} />
        <Route path="/supplier-invoice/reversal/view" element={<SupplierInvoiceReversal />} />
        <Route path="/supplier-invoice/reversal/edit" element={<SupplierInvoiceReversal />} />
        <Route path="/supplier-invoice/reversal/create" element={<SupplierInvoiceReversal />} />
        <Route path="/supplier-invoice-rcm/reversal/create" element={<SupplierInvoiceReversal />} />
        <Route path="/journal-voucher" element={<JournalVoucherMaster />} />
        <Route path="/journal-voucher/create" element={<JournalVoucher />} />
        <Route path="/journal-voucher/edit/:id" element={<JournalVoucher />} />
        <Route path="/journal-voucher/view/:id" element={<JournalVoucher />} />
        <Route
          path="/journal-voucher-reversal"
          element={<JournalVoucherReversalMaster />}
        />
        <Route path="/journal-voucher-reversal/create" element={<JournalVoucherReversal />} />
        <Route path="/journal-voucher-reversal/edit/:id" element={<JournalVoucherReversal />} />
        <Route path="/journal-voucher-reversal/view/:id" element={<JournalVoucherReversal />} />
        <Route path="/subledger-enquiry" element={<SubledgerEnquiry />} />
        <Route path="/document-allocation" element={<DocumentAllocationList />} />
        <Route path="/document-allocation/create" element={<DocumentAllocation />} />
        <Route path="/debit-credit-note-non-trade" element={<Outlet />}>
          <Route index element={<DebitCreditNoteNonTradeMaster />} />
          <Route path="create" element={<DebitCreditNoteNonTradeCreate />} />
          <Route path="edit/:id" element={<DebitCreditNoteNonTradeCreate />} />
          <Route path="view/:id" element={<DebitCreditNoteNonTradeCreate />} />
        </Route>
        <Route path="/debit-credit-note-trade" element={<Outlet />}>
          <Route index element={<DebitCreditNoteTradeMaster />} />
          <Route path="create" element={<DebitCreditNoteTradeCreate />} />
          <Route path="edit/:id" element={<DebitCreditNoteTradeCreate />} />
          <Route path="view/:id" element={<DebitCreditNoteTradeCreate />} />
        </Route>
        <Route path="/payment-request" element={<PaymentRequestCreate />} />
        <Route path="/payment-request/create" element={<PaymentRequestCreate />} />
        <Route path="/payment-request/edit/:id" element={<PaymentRequestCreate />} />
        <Route path="/payment-request/view/:id" element={<PaymentRequestCreate />} />
        <Route path="/payment-request-approval" element={<PaymentRequestApproval />} />
        <Route path="/settings" element={<DemoPage />} />
        <Route path="/lead" element={<LeadList />} />
        <Route path="/lead-create" element={<CreateLead />} />
        <Route path="/call-entry" element={<CallEntry />} />
        <Route path="/call-entry-create" element={<CallEntryNew />} />
        <Route path="/call-entry-create/:id" element={<CallEntryNew />} />
        <Route path="/call-entry-calendar" element={<CallEntryCalendar />} />
        <Route path="/enquiry" element={<EnquiryMaster />} />
        <Route path="/enquiry-create" element={<EnquiryCreate />} />
        <Route path="/rfq" element={<RFQMaster />} />
        <Route path="/rfq-create" element={<RFQCreate />} />
        <Route path="/last-enquiries" element={<LastEnquiriesList />} />
        <Route path="/get-rate" element={<GetRate />} />
        <Route path="/quotation-create" element={<QuotationCreatePage />} />
        <Route path="/quotation-create/:id" element={<QuotationCreatePage />} />
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
        <Route
          path="tariff"
          //  element={<Tariff />}
        >
          <Route path="freight" element={<Freight />} />
          <Route path="contracts" element={<TariffContractsListRoute />}>
            <Route path=":carrierCode/:service" element={<TariffContractsDetail />} />
          </Route>
          <Route path="contracts/create" element={<CreateContract />} />
          <Route path="freight/create" element={<FreightCreate />} />
          <Route path="origin" element={<Origin />} />
          <Route path="origin/create" element={<OriginCreate />} />
          <Route path="destination" element={<DestinationMaster />} />
          <Route path="destination/create" element={<DestinationCreate />} />
        </Route>
        <Route path="/tariff-create" element={<TariffCreate />} />
        <Route path="/tariff-bulk-upload" element={<TariffBulkUpload />} />
        <Route path="/automation/import-job" element={<HBLDocumentManager />} />
        <Route path="/automation/vendor-invoice" element={<Invoice />} />
        <Route path="/automation/odex-jobs" element={<OdexJobsMaster />} />
        <Route
          path="/automation/odex-jobs/:jobId"
          element={<OdexJobDetail />}
        />
        <Route path="/odex-jobs" element={<Navigate to="/automation/odex-jobs" replace />} />
        <Route path="/odex-jobs/:jobId" element={<OdexLegacyJobRedirect />} />
        <Route
          path="/automation/job-creation"
          element={<Navigate to="/automation/import-job" replace />}
        />
        <Route
          path="/automation/invoice-manager"
          element={<Navigate to="/automation/vendor-invoice" replace />}
        />
        <Route
          path="/workflow/hbl-document-manager"
          element={<Navigate to="/automation/import-job" replace />}
        />
        <Route
          path="/workflow/invoice-manager"
          element={<Navigate to="/automation/vendor-invoice" replace />}
        />
        <Route
          path="/hbl-document-manager"
          element={<Navigate to="/automation/import-job" replace />}
        />
        <Route path="/workflow/chatbot" element={<Chatbot />} />
        <Route path="/workflow/chatbot-google" element={<ChatbotGoogleApi />} />
        <Route path="/workflow/chatbot-browser" element={<ChatbotBrowser />} />
        <Route
          path="/workflow/analytics-chat"
          element={<Navigate to="/workflow/chatbot?type=analytics" replace />}
        />
        <Route
          path="/workflow/analytics-training"
          element={<Navigate to="/workflow/chatbot?type=analytics" replace />}
        />
        <Route path="/chatbot" element={<NavigateKeepSearch to="/workflow/chatbot" />} />
        <Route
          path="/chatbot-google"
          element={<NavigateKeepSearch to="/workflow/chatbot-google" />}
        />
        <Route
          path="/chatbot-browser"
          element={<NavigateKeepSearch to="/workflow/chatbot-browser" />}
        />
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
          <Route path="create-customer-pan" element={<CustomerPanMaster />} />
          <Route path="create-customer" element={<CustomerCreate />} />
          <Route
            path="approve-customers"
            element={<ApproveCustomerPanMaster />}
          />
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

          <Route path="vendor">
            <Route index element={<VendorMaster />} />
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
            <Route
              path="create"
              element={<CustomerRelationshipMappingCreate />}
            />
            <Route
              path="edit"
              element={<CustomerRelationshipMappingCreate />}
            />
          </Route>

          <Route path="service" element={<ServiceMaster />} />
          <Route path="service-new" element={<ServiceMasterNew />} />
          <Route path="service-edit" element={<ServiceMasterEdit />} />
          <Route path="service-view" element={<ServiceMasterView />} />

          <Route path="port">
            <Route index element={<PortMaster />} />
            <Route path="create" element={<PortCreate />} />
            <Route path="edit" element={<PortCreate />} />
            <Route path="view" element={<PortCreate />} />
          </Route>
          <Route
            path="port-new"
            element={<Navigate to="/master/port/create" replace />}
          />
          <Route
            path="port-edit"
            element={<Navigate to="/master/port/edit" replace />}
          />
          <Route
            path="port-view"
            element={<Navigate to="/master/port/view" replace />}
          />

          <Route path="cfs-master">
            <Route index element={<CFSMaster />} />
            <Route path="create" element={<CFSCreate />} />
            <Route path="edit" element={<CFSCreate />} />
          </Route>

          <Route path="charge">
            <Route index element={<ChargeMaster />} />
            <Route path="create" element={<ChargeCreate />} />
            <Route path="edit" element={<ChargeCreate />} />
          </Route>

          <Route path="tds-section">
            <Route index element={<TdsSectionMaster />} />
            <Route path="create" element={<TdsSectionCreate />} />
            <Route path="edit" element={<TdsSectionCreate />} />
          </Route>

          <Route path="tds-rate-section">
            <Route index element={<TdsRateSectionMaster />} />
            <Route path="create" element={<TdsRateSectionCreate />} />
            <Route path="edit" element={<TdsRateSectionCreate />} />
          </Route>

          <Route path="network-master">
            <Route index element={<NetworkMaster />} />
            <Route path="create" element={<NetworkCreate />} />
            <Route path="edit" element={<NetworkCreate />} />
          </Route>

          <Route path="chart-of-accounts">
            <Route index element={<ChartOfAccountsMaster />} />
            <Route path="create" element={<ChartOfAccountsCreate />} />
            <Route path="edit" element={<ChartOfAccountsCreate />} />
          </Route>

          <Route path="gl-charge-mapping">
            <Route index element={<GLChargeMappingMaster />} />
            <Route path="create" element={<GLChargeMappingCreate />} />
            <Route path="edit" element={<GLChargeMappingCreate />} />
          </Route>

          <Route path="gst-sac">
            <Route index element={<GSTSACMaster />} />
            <Route path="create" element={<GSTSACCreate />} />
            <Route path="edit" element={<GSTSACCreate />} />
          </Route>

          <Route path="gst-rate">
            <Route index element={<GSTRateMaster />} />
            <Route path="create" element={<GSTRateMaster />} />
            <Route path="edit" element={<GSTRateMaster />} />
          </Route>

          <Route path="gst-charge-mapping">
            <Route index element={<GSTChargeMappingMaster />} />
            <Route path="create" element={<GSTChargeMappingCreate />} />
            <Route path="edit" element={<GSTChargeMappingCreate />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
};

export default NavigationRoutes;
