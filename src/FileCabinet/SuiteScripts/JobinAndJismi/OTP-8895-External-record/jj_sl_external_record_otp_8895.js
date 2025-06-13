/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
/**********************************************************************************************
* 
*
*
*
${OTP-8895}:{External Custom Record form and actions}
*
*
**************************************************************************************************
*
*Author:Jobin and Jismi IT Services
*
*Date Created:30-may-2025
*
*Description:This script is designed to generate records for a custom record type in NetSuite, incorporating fields such as Customer Name, Email,
*Customer Reference, Subject, and Message. The Customer Reference field automatically links to the corresponding customer record when an existing
*customer with the same email address is found in the system.
*
** REVISION HISTORY
 *
* @version 1.0 30-May-2025 : Created the initial build by JJ0403
*/

define(['N/record', 'N/ui/serverWidget', 'N/search', 'N/url', 'N/email'],
    /**
 * @param{email} email
 * @param{record} record
 * @param{serverWidget} serverWidget
 */
    (record, serverWidget, search, url, email) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            try {
                if (scriptContext.request.method === 'GET') {
                    const form = createCustomerForm();
                    scriptContext.response.writePage(form);
                } else {
                    const customerData = {
                        name: scriptContext.request.parameters.custpage_name,
                        email: scriptContext.request.parameters.custpage_email,
                        subject: scriptContext.request.parameters.custpage_subject,
                        message: scriptContext.request.parameters.custpage_message
                    };

                    const { custId, custEmail, salesEmail } = findCustomerByEmail(customerData.email);
                    const recordId = createExternalCustomerRecord(customerData, custId);

                    scriptContext.response.write(`Custom record created successfully! Internal ID: ${recordId}`);
                    sendNotificationEmails(salesEmail);
                }
            } catch (error) {
                log.error('Unexpected Error occurred', error);
            }
        };

        /**
         * Creates the customer form.
         * @returns {serverWidget.Form} The customer form.
         */
        const createCustomerForm = () => {
            const form = serverWidget.createForm({
                title: 'External customer Form'
            });

            form.addField({
                id: 'custpage_name',
                type: serverWidget.FieldType.TEXT,
                label: 'Customer Name'
            }).isMandatory = true;

            form.addField({
                id: 'custpage_email',
                type: serverWidget.FieldType.TEXT,
                label: 'Customer Email'
            }).isMandatory = true;

            form.addField({
                id: 'custpage_subject',
                type: serverWidget.FieldType.TEXT,
                label: 'Subject'
            });

            form.addField({
                id: 'custpage_message',
                type: serverWidget.FieldType.TEXT,
                label: 'Message'
            });

            form.addSubmitButton({ label: 'Submit' });
            return form;
        };

        /**
         * Searches for a customer by email.
         * @param {string} email - The customer email.
         * @returns {Object} Customer details including ID and sales rep email.
         */
        const findCustomerByEmail = (email) => {
            let custId = null;
            let custEmail = null;
            let salesEmail = '';

            search.create({
                type: "customer",
                filters: [["email", "is", email]],
                columns: [
                    search.createColumn({ name: "email", label: "Email" }),
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "email", join: "salesRep", label: "Email" }),
                    search.createColumn({name: "email", join: "salesRep", label: "Email"})
                ]
            }).run().each((result) => {
                custEmail = result.getValue('email');
                custId = result.getValue('internalid');
                salesEmail = result.getValue({ name: "email", join: "salesRep" });                
            });

            return { custId, custEmail, salesEmail };
        };

        /**
         * Creates an external customer record.
         * @param {Object} customerData - The customer input details.
         * @param {string} customerId - Customer ID if found.
         * @returns {string} The created record ID.
         */
        const createExternalCustomerRecord = (customerData, customerId) => {
            const ExternalRecord = record.create({
                type: "customrecord_jj_external_customer_record"
            });

            ExternalRecord.setValue({ fieldId: "custrecord_jj_customer_name", value: customerData.name });
            ExternalRecord.setValue({ fieldId: "custrecord_jj_customer_email", value: customerData.email });
            ExternalRecord.setValue({ fieldId: "custrecord_jj_subject", value: customerData.subject });
            ExternalRecord.setValue({ fieldId: "custrecord_jj_message", value: customerData.message });
            let custRefer = ExternalRecord.getValue({ fieldId: "custrecord_jj_customer"});

            if (customerId) {

                ExternalRecord.setValue({ fieldId: "custrecord_jj_customer", value: customerId });
            }

            return ExternalRecord.save({ ignoreMandatory: true });
        };

        /**
         * Sends an email notification upon record creation.
         * @param {string} salesEmail - Sales representative email.
         */
        const sendNotificationEmails = (salesEmail) => {

        let senderName = '';

        search.create({
            type: "employee",
            filters: [["internalid", "is", "-5"]],
            columns: [search.createColumn({ name: "entityid", label: "Name" })]
        }).run().each((result) => {
            senderName = result.getValue("entityid");
            return false; 
        });

            if (salesEmail) {
                email.send({
                author: -5,
                recipients: salesEmail,
                subject: 'Record Creation',
                body: `Dear ${salesEmail},

            I hope this email finds you well.

            I wanted to inform you that a custom record has been successfully created. Please review the details at your earliest convenience and let me know if you need any further information.

            Best regards,  
            ${senderName}`
            });

            }

            email.send({
                author: -5,
                recipients: -5,
                subject: 'Record Creation',
                body: `Dear ${senderName},

            I hope this email finds you well.

            I wanted to inform you that a custom record has been successfully created. Please review the details at your earliest convenience and let me know if you need any further information.

            Best regards,  
            ${senderName}`
            });
        };

        return { onRequest };
    });
