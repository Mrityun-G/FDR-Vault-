-- Dates are Indian dates: "today" (current_date in the FDR and application checks, daily reminders) follows
-- India Standard Time, not UTC — otherwise between 00:00 and 05:30 IST today's date is rejected as "in the future".
-- Applies to new database connections; timestamps keep their exact instant (timestamptz), only the display zone changes.
do $$
begin
  execute format('alter database %I set timezone to %L', current_database(), 'Asia/Kolkata');
end $$;
