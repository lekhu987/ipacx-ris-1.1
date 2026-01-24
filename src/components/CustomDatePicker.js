import React, { useState, useRef, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function CustomDatePicker({ filters, setFilters }) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef(null);

  // Helper to format YYYYMMDD string to DD/MM/YYYY for display
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "";
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}/${month}/${year}`;
  };

  // Convert "YYYYMMDD" string from filters back to Date objects for the calendar
  const parseDICOMDate = (dateStr) => {
    if (!dateStr) return null;
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  };

  const startDate = parseDICOMDate(filters.startDate);
  const endDate = parseDICOMDate(filters.endDate);

  const applyDateFilter = (type) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = new Date(today);
    let end = new Date(today);

    // Internal format remains YYYYMMDD for logic/filtering
    const formatDate = (d) => d.toISOString().split("T")[0].replace(/-/g, "");

    switch (type) {
      case "today":
        break;
      case "yesterday":
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
        break;
      case "this_week":
        start.setDate(today.getDate() - today.getDay());
        break;
      case "this_month":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case "last_12":
        start.setFullYear(today.getFullYear() - 1);
        break;
      default:
        break;
    }

    setFilters((prev) => ({
      ...prev,
      startDate: formatDate(start),
      endDate: formatDate(end),
    }));
  };

  const handleCalendarChange = (dates) => {
    const [start, end] = dates;
    const formatDate = (d) => (d ? d.toISOString().split("T")[0].replace(/-/g, "") : "");
    
    setFilters((prev) => ({
      ...prev,
      startDate: formatDate(start),
      endDate: formatDate(end),
    }));
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="date-header-cell" ref={datePickerRef}>
      <div className="th-title">Study Date</div>
      <div onClick={() => setShowDatePicker(!showDatePicker)} className="date-trigger-input">
        {filters.startDate ? 
          // Use the formatDisplayDate helper here
          `${formatDisplayDate(filters.startDate)}${filters.endDate ? ' - ' + formatDisplayDate(filters.endDate) : ''}` : 
          "Select Date 📅"}
      </div>

      {showDatePicker && (
        <div className="orthanc-style-picker">
          <div className="picker-sidebar">
            <div className="shortcut-item" onClick={() => applyDateFilter("today")}>Today</div>
            <div className="shortcut-item" onClick={() => applyDateFilter("yesterday")}>Yesterday</div>
            <div className="shortcut-item" onClick={() => applyDateFilter("this_week")}>This week</div>
            <div className="shortcut-item" onClick={() => applyDateFilter("this_month")}>This month</div>
            <div className="shortcut-item" onClick={() => applyDateFilter("last_12")}>Last 12 months</div>
          </div>

          <div className="picker-main">
            <DatePicker
              selected={startDate}
              onChange={handleCalendarChange}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              inline
              calendarStartDay={1} 
            />
            <div className="picker-footer">
              <button className="cancel-btn" onClick={() => {
                setFilters(prev => ({...prev, startDate: "", endDate: ""}));
                setShowDatePicker(false);
              }}>Clear</button>
              <button className="select-btn" onClick={() => setShowDatePicker(false)}>Select</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}