const mongoose = require("mongoose");
const crypto = require("crypto");
const User = require("../models/User");
const Advocate = require("../models/Advocate");
const Template = require("../models/Template");
const UserFilledTemplate = require("../models/UserFilledTemplate");
const { sendInviteEmail } = require("./sendOTP");

const buildFilledImageMap = (multerFiles = []) => {
    const map = {};
    if (Array.isArray(multerFiles)) {
        for (const file of multerFiles) {
            if (file.fieldname.startsWith("filledImage_")) {
                const fieldName = file.fieldname.slice("filledImage_".length).toLowerCase();
                map[fieldName] = file.path;
            }
        }
    }
    return map;
};

const enrichFilledFields = (filledFields, templatePartyFields, uploadedImageMap) => {
    const enriched = filledFields.map((userField) => {
        const templateField = templatePartyFields.find(
            (f) => f.fieldName.trim().toLowerCase() === userField.fieldName.trim().toLowerCase()
        );
        const fieldType = templateField?.fieldType || "text";
        const key = userField.fieldName.trim().toLowerCase();
        let value = userField.value;
        if (fieldType === "image" && uploadedImageMap[key]) {
            value = uploadedImageMap[key];
        }
        return { fieldName: userField.fieldName.trim(), fieldType, value };
    });

    for (const [key, filePath] of Object.entries(uploadedImageMap)) {
        const alreadyEnriched = enriched.some((f) => f.fieldName.toLowerCase() === key);
        if (!alreadyEnriched) {
            const templateField = templatePartyFields.find(
                (f) => f.fieldName.trim().toLowerCase() === key
            );
            if (templateField) {
                enriched.push({ fieldName: templateField.fieldName, fieldType: "image", value: filePath });
            }
        }
    }
    return enriched;
};

const validateRequiredFields = (templatePartyFields, filledFields, uploadedImageMap) => {
    const missing = [];
    for (const templateField of templatePartyFields) {
        if (!templateField.required) continue;
        const userField = filledFields.find(
            (f) => f.fieldName.trim().toLowerCase() === templateField.fieldName.trim().toLowerCase()
        );
        if (templateField.fieldType === "image") {
            const key = templateField.fieldName.trim().toLowerCase();
            const hasUpload = !!uploadedImageMap[key];
            const hasValue = userField && userField.value !== null && String(userField.value).trim() !== "";
            if (!hasUpload && !hasValue) missing.push(templateField.fieldName);
        } else {
            const isEmpty = !userField || userField.value === null || String(userField.value).trim() === "";
            if (isEmpty) missing.push(templateField.fieldName);
        }
    }
    return missing;
};

const cleanFieldsForResponse = (fields) =>
    fields.map((f) => {
        const field = {
            fieldName: f.fieldName,
            fieldType: f.fieldType,
            required: f.required,
            placeholder: f.placeholder,
        };
        if (f.fieldType === "dropdown") field.options = f.options;
        if (f.fieldType === "image" && f.defaultImagePath) field.defaultImagePath = f.defaultImagePath;
        return field;
    });

const getPartyFields = async (req, res) => {
    try {
        const { templateId } = req.params;
        const { partyName, role, token } = req.query;

        if (!mongoose.Types.ObjectId.isValid(templateId))
            return res.status(400).json({ success: false, message: "Invalid template ID" });

        // ✅ role validate
        if (!role?.trim() || !["main_case_holder", "invited_person"].includes(role))
            return res.status(400).json({ success: false, message: "role is required: main_case_holder or invited_person" });

        const template = await Template.findOne({ _id: templateId, isActive: true }).select("-__v");
        if (!template)
            return res.status(404).json({ success: false, message: "Template not found or inactive" });

        // ✅ CASE 1: Invited person - token se dhundho
        if (role === "invited_person") {
            if (!token?.trim())
                return res.status(400).json({ success: false, message: "token is required for invited_person" });

            const userFilledTemplate = await UserFilledTemplate.findOne({
                templateId: template._id,
                "parties.inviteToken": token,
            });

            if (!userFilledTemplate)
                return res.status(404).json({ success: false, message: "Invalid or expired invite token" });

            const invitedParty = userFilledTemplate.parties.find((p) => p.inviteToken === token);
            if (!invitedParty)
                return res.status(404).json({ success: false, message: "Party not found" });

            if (invitedParty.status === "filled")
                return res.status(400).json({ success: false, message: "You have already filled the form" });

            const templateParty = template.parties.find(
                (p) => p.partyName.trim().toLowerCase() === invitedParty.partyName.trim().toLowerCase()
            );

            if (!templateParty)
                return res.status(404).json({ success: false, message: "Template party not found" });

            return res.status(200).json({
                success: true,
                message: `Fields for ${invitedParty.partyName} as invited_person`,
                data: {
                    templateId: template._id,
                    userFilledTemplateId: userFilledTemplate._id,  // ✅ fillParty ke liye
                    partyId: invitedParty._id,                     // ✅ fillParty ke liye
                    title: template.title,
                    practiceArea: template.practiceArea,
                    category: template.category,
                    partyName: invitedParty.partyName,
                    role: "invited_person",
                    status: invitedParty.status,
                    partyFields: templateParty.fields.map((f) => ({
                        fieldName: f.fieldName,
                        fieldType: f.fieldType,
                        required: f.required,
                        placeholder: f.placeholder,
                        ...(f.fieldType === "dropdown" && { options: f.options }),
                        ...(f.fieldType === "image" && f.defaultImagePath && { defaultImagePath: f.defaultImagePath }),
                    })),
                    generalFields: cleanFieldsForResponse(template.fields),
                },
            });
        }

        // ✅ CASE 2: Main case holder - partyName se dhundho
        if (!partyName?.trim())
            return res.status(400).json({ success: false, message: "partyName is required for main_case_holder" });

        const party = template.parties.find(
            (p) => p.partyName.trim().toLowerCase() === partyName.trim().toLowerCase()
        );
        if (!party)
            return res.status(404).json({ success: false, message: `Party "${partyName}" not found in template` });

        if (!party.isMainCaseHolder)
            return res.status(400).json({ success: false, message: `Party "${partyName}" cannot be main case holder` });

        return res.status(200).json({
            success: true,
            message: `Fields for ${partyName} as main_case_holder`,
            data: {
                templateId: template._id,
                title: template.title,
                practiceArea: template.practiceArea,
                category: template.category,
                partyName: party.partyName,
                role: "main_case_holder",
                partyFields: party.fields.map((f) => ({
                    fieldName: f.fieldName,
                    fieldType: f.fieldType,
                    required: f.required,
                    placeholder: f.placeholder,
                    ...(f.fieldType === "dropdown" && { options: f.options }),
                    ...(f.fieldType === "image" && f.defaultImagePath && { defaultImagePath: f.defaultImagePath }),
                })),
                generalFields: cleanFieldsForResponse(template.fields),
            },
        });

    } catch (error) {
        console.error("getPartyFields Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


const startTemplate = async (req, res) => {
    try {
        const { templateId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(templateId))
            return res.status(400).json({ success: false, message: "Invalid template ID" });

        if (!req.user?._id)
            return res.status(401).json({ success: false, message: "Unauthorized" });

        let filledFields = [];
        let partyName = "";
        let role = "";
        let email = "";
        try {
            partyName = req.body.partyName || "";
            role = req.body.role || "";
            email = req.body.email || "";
            if (req.body.filledFields) {
                filledFields = typeof req.body.filledFields === "string"
                    ? JSON.parse(req.body.filledFields.trim())
                    : req.body.filledFields;
            }
        } catch (e) {
            return res.status(400).json({ success: false, message: "Invalid JSON in filledFields" });
        }

        // ✅ partyName validate
        if (!partyName?.trim())
            return res.status(400).json({ success: false, message: "partyName is required" });

        // ✅ role validate
        if (!role?.trim() || !["main_case_holder", "invited_person"].includes(role))
            return res.status(400).json({ success: false, message: "role is required: main_case_holder or invited_person" });

        // ✅ email validate (agar diya ho to)
        if (email?.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim()))
                return res.status(400).json({ success: false, message: "Invalid email format" });
        }

        const template = await Template.findOne({ _id: templateId, isActive: true });
        if (!template)
            return res.status(404).json({ success: false, message: "Template not found or inactive" });

        // ✅ Template mein party exist karti hai?
        const templateParty = template.parties.find(
            (p) => p.partyName.trim().toLowerCase() === partyName.trim().toLowerCase()
        );
        if (!templateParty)
            return res.status(400).json({ success: false, message: `Party "${partyName}" not found in template` });

        // ✅ role ke hisaab se check karo
        if (role === "main_case_holder" && !templateParty.isMainCaseHolder)
            return res.status(400).json({ success: false, message: `Party "${partyName}" cannot be main case holder` });

        if (role === "invited_person" && !templateParty.isInvitedPerson)
            return res.status(400).json({ success: false, message: `Party "${partyName}" cannot be invited person` });

        // ✅ Kya ye user pehle se is template ka main case holder hai?
        const existingRecord = await UserFilledTemplate.findOne({
            templateId: template._id,
            userId: req.user._id,
        });
        if (existingRecord)
            return res.status(409).json({ success: false, message: "You have already started this template" });

        if (!Array.isArray(filledFields) || filledFields.length === 0)
            return res.status(400).json({ success: false, message: "filledFields are required" });

        const uploadedImageMap = buildFilledImageMap(req.files);

        // ✅ Required fields validate karo
        const missing = validateRequiredFields(templateParty.fields, filledFields, uploadedImageMap);
        if (missing.length > 0)
            return res.status(400).json({ success: false, message: `Required fields missing: ${missing.join(", ")}` });

        const enrichedFields = enrichFilledFields(filledFields, templateParty.fields, uploadedImageMap);

        // ✅ Baaki parties "pending" ke saath initialize karo
        const allParties = template.parties.map((p) => {
            if (p.partyName.trim().toLowerCase() === partyName.trim().toLowerCase()) {
                return {
                    partyName: p.partyName,
                    role: role,
                    email: email?.trim().toLowerCase() || null, // ✅ email save hogi
                    userId: req.user._id,
                    inviteToken: null,
                    status: "filled",
                    filledFields: enrichedFields,
                };
            } else {
                return {
                    partyName: p.partyName,
                    role: "invited_person",
                    email: null,
                    userId: null,
                    inviteToken: null,
                    status: "pending",
                    filledFields: [],
                };
            }
        });

        const userFilledTemplate = await UserFilledTemplate.create({
            templateId: template._id,
            advocateId: template.advocateId,
            userId: req.user._id,
            title: template.title,
            practiceArea: template.practiceArea,
            category: template.category,
            parties: allParties,
            templateStatus: "in_progress",
            status: "submitted",
        });

        return res.status(201).json({
            success: true,
            message: "Template started successfully! Now invite other parties.",
            data: userFilledTemplate,
        });

    } catch (error) {
        console.error("startTemplate Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


const inviteParties = async (req, res) => {
    try {
        const { templateId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(templateId))
            return res.status(400).json({ success: false, message: "Invalid template ID" });

        if (!req.user?._id)
            return res.status(401).json({ success: false, message: "Unauthorized" });

        let invites = [];
        try {
            invites = typeof req.body.invites === "string"
                ? JSON.parse(req.body.invites.trim())
                : req.body.invites;
        } catch (e) {
            return res.status(400).json({ success: false, message: "Invalid JSON in invites" });
        }

        if (!Array.isArray(invites) || invites.length === 0)
            return res.status(400).json({ success: false, message: "invites array is required" });

        const userFilledTemplate = await UserFilledTemplate.findOne({
            _id: templateId,
            userId: req.user._id,
            templateStatus: "in_progress",
        });

        if (!userFilledTemplate)
            return res.status(404).json({ success: false, message: "Template record not found. Please start template first." });

        const template = await Template.findById(userFilledTemplate.templateId);
        const mainCaseHolder = await User.findById(req.user._id).select("fullName email");

        for (const invite of invites) {
            if (!invite.partyName?.trim())
                return res.status(400).json({ success: false, message: "partyName is required in invites" });

            if (!invite.email?.trim())
                return res.status(400).json({ success: false, message: `Email is required for party "${invite.partyName}"` });

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(invite.email.trim()))
                return res.status(400).json({ success: false, message: `Invalid email for party "${invite.partyName}"` });

            const party = userFilledTemplate.parties.find(
                (p) => p.partyName.trim().toLowerCase() === invite.partyName.trim().toLowerCase()
            );

            if (!party)
                return res.status(400).json({ success: false, message: `Party "${invite.partyName}" not found` });

            if (party.status === "filled")
                return res.status(400).json({ success: false, message: `Party "${invite.partyName}" has already filled the form` });

            const inviteToken = crypto.randomBytes(32).toString("hex");

            party.email = invite.email.trim().toLowerCase();
            party.inviteToken = inviteToken;
            party.status = "invited";

            // ✅ NEW: Check karo email already registered hai ya nahi
            const existingUser = await User.findOne({ email: invite.email.trim().toLowerCase() });
            party.isUserRegistered = !!existingUser;

            const acceptLink = `http://192.168.11.64:5000/api/templates/${userFilledTemplate._id}/accept/${inviteToken}`;

            // ✅ NEW: registered hai to login, nahi hai to register
            const loginLink = existingUser
                ? `http://192.168.11.63:5174/login`
                : `http://192.168.11.63:5174/register`;

            try {
                await sendInviteEmail({
                    toEmail: invite.email.trim(),
                    toName: invite.partyName,
                    inviterName: mainCaseHolder.fullName,
                    templateTitle: template.title,
                    acceptLink,
                    loginLink,
                    inviteToken,
                    isRegistered: !!existingUser, // ✅ NEW
                });
                console.log(`✅ Invite email sent to: ${invite.email}`);
            } catch (emailErr) {
                console.warn(`⚠️ Invite email failed for ${invite.email}:`, emailErr.message);
            }
        }

        await userFilledTemplate.save();

        return res.status(200).json({
            success: true,
            message: "Invites sent successfully!",
            data: userFilledTemplate,
        });

    } catch (error) {
        console.error("inviteParties Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


const acceptInvite = async (req, res) => {
    try {
        const { templateId, token } = req.params;

        if (!mongoose.Types.ObjectId.isValid(templateId))
            return res.status(400).json({ success: false, message: "Invalid template ID" });

        const userFilledTemplate = await UserFilledTemplate.findOne({
            _id: templateId,
            "parties.inviteToken": token,
        });

        if (!userFilledTemplate)
            return res.redirect("http://192.168.11.63:5174/login?error=invalid_token"); // ✅ 5174

        const party = userFilledTemplate.parties.find((p) => p.inviteToken === token);

        if (!party)
            return res.redirect("http://192.168.11.63:5174/login?error=party_not_found"); // ✅ 5174

        if (party.status === "accepted" || party.status === "filled")
            return res.redirect("http://192.168.11.63:5174/login?error=already_accepted"); // ✅ 5174

        // ✅ Status update karo
        party.status = "accepted";
        await userFilledTemplate.save();

        // ✅ Login page pe redirect karo
        return res.redirect("http://192.168.11.63:5174/login?invite=accepted"); // ✅ 5174

    } catch (error) {
        console.error("acceptInvite Error:", error);
        return res.redirect("http://192.168.11.63:5174/login?error=server_error"); // ✅ 5174
    }
};


const fillParty = async (req, res) => {
    try {
        const { templateId, partyId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(templateId) || !mongoose.Types.ObjectId.isValid(partyId))
            return res.status(400).json({ success: false, message: "Invalid ID" });

        if (!req.user?._id)
            return res.status(401).json({ success: false, message: "Unauthorized" });

        let filledFields = [];
        try {
            if (req.body.filledFields) {
                filledFields = typeof req.body.filledFields === "string"
                    ? JSON.parse(req.body.filledFields.trim())
                    : req.body.filledFields;
            }
        } catch (e) {
            return res.status(400).json({ success: false, message: "Invalid JSON in filledFields" });
        }

        if (!Array.isArray(filledFields) || filledFields.length === 0)
            return res.status(400).json({ success: false, message: "filledFields are required" });

        const userFilledTemplate = await UserFilledTemplate.findById(templateId);
        if (!userFilledTemplate)
            return res.status(404).json({ success: false, message: "Template record not found" });

        const party = userFilledTemplate.parties.id(partyId);
        if (!party)
            return res.status(404).json({ success: false, message: "Party not found" });

        if (party.status !== "accepted")
            return res.status(400).json({ success: false, message: "Please accept the invite first" });

        const template = await Template.findById(userFilledTemplate.templateId);
        const templateParty = template.parties.find(
            (p) => p.partyName.trim().toLowerCase() === party.partyName.trim().toLowerCase()
        );

        if (!templateParty)
            return res.status(404).json({ success: false, message: "Template party not found" });

        const uploadedImageMap = buildFilledImageMap(req.files);

        const missing = validateRequiredFields(templateParty.fields, filledFields, uploadedImageMap);
        if (missing.length > 0)
            return res.status(400).json({ success: false, message: `Required fields missing: ${missing.join(", ")}` });

        const enrichedFields = enrichFilledFields(filledFields, templateParty.fields, uploadedImageMap);

        party.userId = req.user._id;
        party.status = "filled";
        party.filledFields = enrichedFields;
        party.isUserRegistered = true;

        const allFilled = userFilledTemplate.parties.every((p) => p.status === "filled");
        if (allFilled) {
            userFilledTemplate.templateStatus = "completed";
            console.log("🎉 All parties filled! Template completed.");

            try {
                const advocate = await Advocate.findById(userFilledTemplate.advocateId).select("email fullName");
                if (advocate) {
                    await sendTemplateCompletedEmail({
                        advocateEmail: advocate.email,
                        advocateName: advocate.fullName,
                        templateTitle: userFilledTemplate.title,
                        submissionId: userFilledTemplate._id.toString(),
                    });
                }
            } catch (emailErr) {
                console.warn("⚠️ Template completed email failed:", emailErr.message);
            }
        }

        await userFilledTemplate.save();

        return res.status(200).json({
            success: true,
            message: allFilled ? "Form filled successfully! Template is now completed." : "Form filled successfully!",
            data: userFilledTemplate,
        });

    } catch (error) {
        console.error("fillParty Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const getTemplateParties = async (req, res) => {
    try {
        const { templateId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(templateId))
            return res.status(400).json({ success: false, message: "Invalid template ID" });

        const template = await Template.findOne({ _id: templateId, isActive: true }).select("-__v");
        if (!template)
            return res.status(404).json({ success: false, message: "Template not found or inactive" });

        return res.status(200).json({
            success: true,
            data: {
                templateId: template._id,
                title: template.title,
                practiceArea: template.practiceArea,
                category: template.category,
                description: template.description,
                // ✅ Har party ke liye sirf naam + role options
                parties: template.parties.map((p) => ({
                    partyName: p.partyName,
                    // ✅ User in options mein se select karega
                    roleOptions: [
                        ...(p.isMainCaseHolder ? [{ role: "main_case_holder", label: "Main Case Holder" }] : []),
                        ...(p.isInvitedPerson ? [{ role: "invited_person", label: "Invited Person" }] : []),
                    ],
                })),
            },
        });

    } catch (error) {
        console.error("getTemplateParties Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    getTemplateParties,
    getPartyFields,
    startTemplate,
    inviteParties,
    acceptInvite,
    fillParty,
};