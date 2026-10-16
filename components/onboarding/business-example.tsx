import {
  ArrowDown,
  ArrowUpRight,
  MessageSquareText,
  PhoneMissed,
} from "lucide-react";

export function BusinessExample({
  businessName,
  area,
}: {
  businessName: string;
  area: string;
}) {
  const business = businessName.trim() || "your roofing team";
  const location = area.trim() || "your service area";
  return (
    <div className="rr-example">
      <div className="rr-example-caption">
        <span className="rr-example-dot" />
        Example for your business
      </div>
      <h2>
        A missed call.
        <br />
        <span>A conversation worth having.</span>
      </h2>
      <div className="rr-example-missed">
        <PhoneMissed size={17} aria-hidden="true" />
        <span>Your team is on a job. A homeowner calls.</span>
      </div>
      <div className="rr-example-conversation">
        <p className="rr-example-business">
          <MessageSquareText size={15} aria-hidden="true" />
          {businessName.trim() || "Your business"}
        </p>
        <p className="rr-example-reply">
          Thanks for calling {business}. Sorry we missed you. What can we help
          with at your property?
        </p>
        <p className="rr-example-homeowner">
          We have a roof leak. Could someone take a look?
        </p>
        <p className="rr-example-explanation">
          RoofReply gathers the roofing details.
        </p>
      </div>
      <ArrowDown className="rr-example-arrow" size={18} aria-hidden="true" />
      <div className="rr-example-summary">
        <p className="rr-example-label">A useful summary for your team</p>
        <h3>Roof leak · homeowner needs a callback</h3>
        <dl>
          <div>
            <dt>Location</dt>
            <dd>{location}</dd>
          </div>
          <div>
            <dt>Urgency</dt>
            <dd>Water coming in when it rains</dd>
          </div>
          <div>
            <dt>Next step</dt>
            <dd>Call the homeowner to review the issue</dd>
          </div>
        </dl>
        <div className="rr-example-handoff">
          Your team takes it from here
          <ArrowUpRight size={16} aria-hidden="true" />
        </div>
      </div>
      <p className="rr-example-footnote">
        Illustrative conversation. No messages are sent, and no inspection is
        booked.
      </p>
    </div>
  );
}
