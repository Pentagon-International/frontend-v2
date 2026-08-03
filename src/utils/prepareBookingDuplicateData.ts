/**
 * Strips identity / document / milestone fields from a booking so it can be
 * used to prefill a new booking create form (duplicate flow).
 */
export function prepareBookingDuplicateData(
  booking: Record<string, unknown>,
): Record<string, unknown> {
  const stripNestedIds = (items: unknown): unknown => {
    if (!Array.isArray(items)) return items;
    return items.map((item) => {
      if (!item || typeof item !== "object") return item;
      const { id: _id, ...rest } = item as Record<string, unknown>;
      return rest;
    });
  };

  const {
    id: _id,
    shipment_code: _shipmentCode,
    mawb_no: _mawbNo,
    mawb_date: _mawbDate,
    bill_no: _billNo,
    bill_date: _billDate,
    actual_pickup_date: _actualPickup,
    actual_delivery_date: _actualDelivery,
    events: _events,
    documents: _documents,
    document_ids: _documentIds,
    document_display_list: _documentDisplayList,
    document_modal_rows: _documentModalRows,
    status: _status,
    job_id: _jobId,
    job_no: _jobNo,
    created_at: _createdAt,
    updated_at: _updatedAt,
    created_by: _createdBy,
    updated_by: _updatedBy,
    last_milestone: _lastMilestone,
    last_milestone_date: _lastMilestoneDate,
    last_milestone_time: _lastMilestoneTime,
    route_milestones: _routeMilestones,
    atd: _atd,
    ata: _ata,
    carrier_booking_no: _carrierBookingNo,
    igm_no: _igmNo,
    igm_date: _igmDate,
    quotation_id: _quotationId,
    quotation_primary_id: _quotationPrimaryId,
    ...rest
  } = booking;

  return {
    ...rest,
    date: new Date().toISOString().slice(0, 10),
    routing_details: stripNestedIds(rest.routing_details),
    cargo_details: stripNestedIds(rest.cargo_details),
    rate_details: stripNestedIds(rest.rate_details),
    housing_details: stripNestedIds(rest.housing_details),
    trigger_updates: stripNestedIds(rest.trigger_updates),
    events: [],
    document_ids: [],
    document_display_list: [],
    document_modal_rows: [],
  };
}
