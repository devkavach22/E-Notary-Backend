const mongoose = require("mongoose");
const Template = require("../models/Template");
const Advocate = require("../models/Advocate");

const PRACTICE_AREAS = [
    "Divorce & Family Law",
    "Domestic Violence",
    "Child Custody & Adoption",
    "Matrimonial Disputes",
    "Maintenance & Alimony",
    "Property & Real Estate",
    "Land Acquisition",
    "Rent & Tenancy",
    "Construction Disputes",
    "Criminal Defense",
    "Bail & Anticipatory Bail",
    "Cyber Crime",
    "Cheque Bounce",
    "POCSO & Child Protection",
    "Civil Litigation",
    "Corporate & Business Law",
    "Contract Disputes",
    "Partnership & Startup Law",
    "Mergers & Acquisitions",
    "Banking & Finance",
    "Tax Law",
    "GST & Indirect Tax",
    "Debt Recovery & Insolvency",
    "Labour & Employment",
    "Wrongful Termination",
    "PF & ESI Disputes",
    "Consumer Protection",
    "RTI & Public Interest",
    "Human Rights",
    "Intellectual Property",
    "Immigration",
    "Motor Accident Claims",
    "Medical Negligence",
    "Insurance Disputes",
    "Environmental Law",
    "Arbitration & Mediation",
];

const VALID_FIELD_TYPES = ["text", "number", "date", "textarea", "image", "file", "dropdown"];

// ── Helper: fields ko clean karke format karo ──────────────
const formatFields = (fields) =>
    fields.map((f) => ({
        fieldName: f.fieldName.trim(),
        fieldType: f.fieldType,
        required: f.required ?? false,
        placeholder: f.placeholder?.trim() || "",
        options: f.fieldType === "dropdown" ? f.options : [], // ✅ only dropdown ko options
    }));

// ── Helper: response mein non-dropdown ke options remove karo ──
const cleanFieldsForResponse = (fields) =>
    fields.map((f) => {
        const field = {
            fieldName: f.fieldName,
            fieldType: f.fieldType,
            required: f.required,
            placeholder: f.placeholder,
        };
        if (f.fieldType === "dropdown") field.options = f.options; // ✅ sirf dropdown mein options
        return field;
    });

// ── Helper: fields validate karo ──────────────────────────
const validateFields = (fields) => {
    for (let i = 0; i < fields.length; i++) {
        const field = fields[i];

        if (!field.fieldName?.trim())
            return `Field ${i + 1}: fieldName is required`;

        if (!field.fieldType)
            return `Field ${i + 1} "${field.fieldName}": fieldType is required`;

        if (!VALID_FIELD_TYPES.includes(field.fieldType))
            return `Field ${i + 1} "${field.fieldName}": Invalid fieldType "${field.fieldType}". Valid types: ${VALID_FIELD_TYPES.join(", ")}`;

        if (field.fieldType === "dropdown") {
            if (!field.options || !Array.isArray(field.options) || field.options.length === 0)
                return `Field "${field.fieldName}" is a dropdown — options array is required`;
        }
    }
    return null; // null = no error
};

// ════════════════════════════════════════════════════════════
// CREATE TEMPLATE
// ════════════════════════════════════════════════════════════
const createTemplate = async (req, res) => {
    try {
        const { practiceArea, caseType, title, description, fields } = req.body;
        const advocateId = req.advocate._id;

        // ── 1. Advocate fetch + approval check ───────────────
        const advocate = await Advocate.findById(advocateId).select(
            "fullName approvalStatus isActive"
        );

        if (!advocate)
            return res.status(404).json({ success: false, message: "Advocate not found" });

        if (advocate.approvalStatus !== "approved" || !advocate.isActive)
            return res.status(403).json({
                success: false,
                message: "Only approved and active advocates can create templates",
            });

        // ── 2. Required field checks ──────────────────────────
        if (!practiceArea?.trim())
            return res.status(400).json({ success: false, message: "Practice area is required" });

        if (!caseType?.trim())
            return res.status(400).json({ success: false, message: "Case type is required" });

        if (!title?.trim())
            return res.status(400).json({ success: false, message: "Template title is required" });

        // ── 3. Practice area validate ─────────────────────────
        if (!PRACTICE_AREAS.includes(practiceArea.trim()))
            return res.status(400).json({
                success: false,
                message: "Invalid practice area. Please select from the available options.",
            });

        // ── 4. Duplicate check ────────────────────────────────
        const existing = await Template.findOne({
            advocateId,
            caseType: caseType.trim(),
            title: title.trim(),
            isActive: true,
        });

        if (existing)
            return res.status(409).json({
                success: false,
                message: "A template with this case type and title already exists",
            });

        // ── 5. Fields validate ────────────────────────────────
        if (!fields || !Array.isArray(fields) || fields.length === 0)
            return res.status(400).json({ success: false, message: "At least one field is required" });

        const fieldError = validateFields(fields);
        if (fieldError)
            return res.status(400).json({ success: false, message: fieldError });

        // ── 6. Template create ────────────────────────────────
        const template = await Template.create({
            advocateId,
            advocateName: advocate.fullName,
            practiceArea: practiceArea.trim(),
            caseType: caseType.trim(),
            title: title.trim(),
            description: description?.trim() || "",
            fields: formatFields(fields),
        });

        // ── 7. Response mein clean fields ─────────────────────
        const responseData = {
            ...template.toObject(),
            fields: cleanFieldsForResponse(template.fields),
        };

        return res.status(201).json({
            success: true,
            message: "Template created successfully",
            data: responseData,
        });

    } catch (error) {
        console.error("createTemplate Error:", error);
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({ success: false, message: messages[0] });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ════════════════════════════════════════════════════════════
// GET ALL TEMPLATES
// ════════════════════════════════════════════════════════════
const getTemplates = async (req, res) => {
    try {
        const advocateId = req.advocate._id;
        const { practiceArea, caseType, isActive, page = 1, limit = 10 } = req.query;

        const filter = { advocateId };

        if (practiceArea?.trim()) filter.practiceArea = practiceArea.trim();
        if (caseType?.trim()) filter.caseType = caseType.trim();
        if (isActive !== undefined) filter.isActive = isActive === "true";

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [templates, total] = await Promise.all([
            Template.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .select("-__v"),
            Template.countDocuments(filter),
        ]);

        // ── Response mein clean fields ────────────────────────
        const data = templates.map((t) => ({
            ...t.toObject(),
            fields: cleanFieldsForResponse(t.fields),
        }));

        return res.status(200).json({
            success: true,
            data,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });

    } catch (error) {
        console.error("getTemplates Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ════════════════════════════════════════════════════════════
// GET SINGLE TEMPLATE BY ID
// ════════════════════════════════════════════════════════════
const getTemplateById = async (req, res) => {
    try {
        const { templateId } = req.params;
        const advocateId = req.advocate._id;

        if (!mongoose.Types.ObjectId.isValid(templateId))
            return res.status(400).json({ success: false, message: "Invalid template ID" });

        const template = await Template.findOne({ _id: templateId, advocateId }).select("-__v");

        if (!template)
            return res.status(404).json({ success: false, message: "Template not found" });

        return res.status(200).json({
            success: true,
            data: {
                ...template.toObject(),
                fields: cleanFieldsForResponse(template.fields),
            },
        });

    } catch (error) {
        console.error("getTemplateById Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


const editTemplate = async (req, res) => {
    try {
        const { templateId } = req.params;
        const advocateId = req.advocate._id;

        if (!mongoose.Types.ObjectId.isValid(templateId))
            return res.status(400).json({ success: false, message: "Invalid template ID" });

        const template = await Template.findOne({ _id: templateId, advocateId });

        if (!template)
            return res.status(404).json({ success: false, message: "Template not found" });

        const { practiceArea, caseType, title, description, fields, isActive } = req.body;

        // ── Practice area ─────────────────────────────────────
        if (practiceArea !== undefined) {
            if (!practiceArea?.trim())
                return res.status(400).json({ success: false, message: "Practice area cannot be empty" });

            if (!PRACTICE_AREAS.includes(practiceArea.trim()))
                return res.status(400).json({
                    success: false,
                    message: "Invalid practice area. Please select from the available options.",
                });

            template.practiceArea = practiceArea.trim();
        }

        // ── caseType & title ──────────────────────────────────
        const newCaseType = caseType !== undefined ? caseType.trim() : template.caseType;
        const newTitle = title !== undefined ? title.trim() : template.title;

        if (caseType !== undefined) {
            if (!caseType?.trim())
                return res.status(400).json({ success: false, message: "Case type cannot be empty" });
        }

        if (title !== undefined) {
            if (!title?.trim())
                return res.status(400).json({ success: false, message: "Title cannot be empty" });
        }

        // ── Duplicate check (exclude current template) ────────
        if (caseType !== undefined || title !== undefined) {
            const duplicate = await Template.findOne({
                advocateId,
                caseType: newCaseType,
                title: newTitle,
                isActive: true,
                _id: { $ne: templateId },
            });

            if (duplicate)
                return res.status(409).json({
                    success: false,
                    message: "A template with this case type and title already exists",
                });
        }

        template.caseType = newCaseType;
        template.title = newTitle;

        if (description !== undefined) template.description = description?.trim() || "";
        if (isActive !== undefined) template.isActive = Boolean(isActive);

        // ── Fields validate & MERGE ───────────────────────────
        if (fields !== undefined) {
            if (!Array.isArray(fields) || fields.length === 0)
                return res.status(400).json({ success: false, message: "At least one field is required" });

            const fieldError = validateFields(fields);
            if (fieldError)
                return res.status(400).json({ success: false, message: fieldError });

            // existing field names (lowercase for case-insensitive check)
            const existingNames = new Set(
                template.fields.map((f) => f.fieldName.toLowerCase())
            );

            const newFields = formatFields(fields).filter(
                (f) => !existingNames.has(f.fieldName.toLowerCase()) // sirf naye fields add karo
            );

            if (newFields.length === 0)
                return res.status(400).json({
                    success: false,
                    message: "All provided fields already exist in this template",
                });

            template.fields = [...template.fields, ...newFields]; // ✅ merge — existing safe
        }

        await template.save();

        return res.status(200).json({
            success: true,
            message: "Template updated successfully",
            data: {
                ...template.toObject(),
                fields: cleanFieldsForResponse(template.fields),
            },
        });

    } catch (error) {
        console.error("editTemplate Error:", error);
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({ success: false, message: messages[0] });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const deleteTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const advocateId     = req.advocate._id;

    if (!mongoose.Types.ObjectId.isValid(templateId))
      return res.status(400).json({ success: false, message: "Invalid template ID" });

    const template = await Template.findOneAndDelete({ _id: templateId, advocateId });

    if (!template)
      return res.status(404).json({ success: false, message: "Template not found" });

    return res.status(200).json({
      success: true,
      message: "Template deleted successfully",
    });

  } catch (error) {
    console.error("deleteTemplate Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { createTemplate, getTemplates, getTemplateById, editTemplate, deleteTemplate };