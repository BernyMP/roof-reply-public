import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
export const metadata: Metadata = pageMetadata("/sms-disclosure", "SMS Messaging Terms & Privacy", "RoofReply service-related SMS disclosures, consent, message frequency and STOP, START and HELP instructions.", true);
export default function SmsDisclosurePage() {
  return (
    <div className="rr-public-page">
      <div className="rr-public-article rr-public-article-wide">
        <h1 className="rr-public-heading rr-public-heading-left">
          SMS Messaging Terms & Privacy
        </h1>

        <div className="rr-public-document rr-public-content">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              About RoofReply SMS Service
            </h2>
            <p className="text-gray-600">
              RoofReply is operated by Web Shinobi LLC. RoofReply provides an
              automated customer-care SMS system for participating roofing
              businesses. Homeowners initiate communication by calling or
              texting a RoofReply-powered number about a roofing service
              inquiry. If your call is missed, RoofReply may send a follow-up
              SMS on behalf of the roofing business to help gather information
              about your roofing needs and connect you with a representative.
              RoofReply also offers a voluntary live SMS demo through the
              RoofReply website for people who explicitly opt in.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Message Frequency
            </h2>
            <p className="text-gray-600">
              Message frequency varies, typically up to 10 automated responses
              per roofing inquiry conversation. These messages gather basic
              information about your roofing inquiry. A human representative
              will follow up directly for any additional communication. SMS is
              customer-care and service related, not marketing or promotional
              messaging. Live demo SMS conversations also vary, typically up to
              10 messages per demo conversation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              RoofReply Live SMS Demo
            </h2>
            <p className="text-gray-600">
              You can request a RoofReply live SMS demo by entering your mobile
              phone number in the optional phone field and selecting the SMS
              consent checkbox at /demo-sms. The demo opt-in language explains
              that message frequency varies, message and data rates may apply,
              you can reply STOP to opt out, you can reply HELP for help, and
              consent is not a condition of purchase. Authenticated RoofReply
              account owners can also allow setup, test, and live demo SMS while
              entering or editing the lead alert phone in onboarding or account
              settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Message & Data Rates
            </h2>
            <p className="text-gray-600">
              Message and data rates may apply. RoofReply does not charge
              homeowners for SMS messages, but your carrier may apply standard
              messaging rates.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Opt-Out Instructions
            </h2>
            <p className="text-gray-600">
              You can opt out of receiving SMS messages at any time by replying{" "}
              <strong>STOP</strong> to any message. You will receive a
              confirmation that you have been unsubscribed. Other opt-out
              keywords include: UNSUBSCRIBE, CANCEL, END, QUIT.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Opt-In Instructions
            </h2>
            <p className="text-gray-600">
              If you have previously opted out and wish to receive messages
              again, you can reply <strong>START</strong> to resubscribe. Other
              opt-in keywords include: UNSTOP, SUBSCRIBE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Help & Support
            </h2>
            <p className="text-gray-600">
              For help with our SMS service, reply <strong>HELP</strong> to any
              message or contact us at hello@example.com. For questions
              about a specific roofing inquiry, please contact the roofing
              company directly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Privacy Policy
            </h2>
            <p className="text-gray-600">
              We collect your phone number and the information you provide
              during SMS conversations (such as name, location, and roofing
              needs) solely to facilitate communication between you and the
              roofing contractor you contacted. Roofing inquiry details may be
              shared with the specific roofing company you are communicating
              with and are not used for marketing purposes. No mobile
              information will be shared with third parties or affiliates for
              marketing or promotional purposes. Text messaging originator
              opt-in data and consent will not be sold, rented, or shared with
              third parties or affiliates for marketing or promotional purposes.
              We may use service providers only as needed to operate the
              messaging program, maintain consent records, deliver messages,
              prevent abuse, provide support, or comply with carrier or legal
              requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Supported Carriers
            </h2>
            <p className="text-gray-600">
              Our SMS service is intended for supported US mobile carriers.
              Availability may vary by carrier, network, and device. Carriers
              are not liable for delayed or undelivered messages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Contact Information
            </h2>
            <p className="text-gray-600">
              Web Shinobi LLC
              <br />
              Operator of RoofReply
              <br />
              Email: hello@example.com
              <br />
              Website: www.roofreply.com
            </p>
          </section>
        </div>

        <p className="rr-public-sms-updated">Last updated: June 17, 2026</p>
      </div>
    </div>
  );
}
