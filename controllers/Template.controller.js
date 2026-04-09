const mongoose = require("mongoose");
const Template = require("../models/Template");
const Advocate = require("../models/Advocate");

const VALID_FIELD_TYPES = ["text", "number", "date", "textarea", "image", "file", "dropdown"];

// ── Helpers ─────────────────────────────────────────────────
const formatFields = (fields) =>
    fields.map((f) => ({
        fieldName: f.fieldName.trim(),
        fieldType: f.fieldType,
        required: f.required ?? false,
        placeholder: f.placeholder?.trim() || "",
        options: f.fieldType === "dropdown" ? f.options : [],
    }));

const cleanFieldsForResponse = (fields) =>
    fields.map((f) => {
        const field = {
            fieldName: f.fieldName,
            fieldType: f.fieldType,
            required: f.required,
            placeholder: f.placeholder,
        };
        if (f.fieldType === "dropdown") field.options = f.options;
        return field;
    });

const validateFields = (fields) => {
    for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (!field.fieldName?.trim()) return `Field ${i + 1}: fieldName is required`;
        if (!field.fieldType) return `Field ${i + 1} "${field.fieldName}": fieldType is required`;
        if (!VALID_FIELD_TYPES.includes(field.fieldType))
            return `Field ${i + 1} "${field.fieldName}": Invalid fieldType.`;
        if (field.fieldType === "dropdown") {
            if (!field.options || !Array.isArray(field.options) || field.options.length === 0)
                return `Field "${field.fieldName}" (dropdown) requires options`;
        }
    }
    return null;
};

// ── CREATE TEMPLATE ──────────────────────────────────────────
const createTemplate = async (req, res) => {
    try {
        const { practiceArea, category, caseType, title, description, fields } = req.body;
        const advocateId = req.advocate._id;

        const advocate = await Advocate.findById(advocateId).select("fullName approvalStatus isActive");
        if (!advocate) return res.status(404).json({ success: false, message: "Advocate not found" });

        if (advocate.approvalStatus !== "approved" || !advocate.isActive)
            return res.status(403).json({ success: false, message: "Unauthorized advocate" });

        // Required field checks
        if (!practiceArea?.trim()) return res.status(400).json({ success: false, message: "Practice area is required" });
        if (!category?.trim()) return res.status(400).json({ success: false, message: "Category is required" });
        if (!caseType?.trim()) return res.status(400).json({ success: false, message: "Case type is required" });
        if (!title?.trim()) return res.status(400).json({ success: false, message: "Template title is required" });

        // Duplicate check
        const existing = await Template.findOne({
            advocateId,
            caseType: caseType.trim(),
            title: title.trim(),
            isActive: true,
        });

        if (existing) return res.status(409).json({ success: false, message: "Template already exists" });

        if (!fields || !Array.isArray(fields) || fields.length === 0)
            return res.status(400).json({ success: false, message: "At least one field is required" });

        const fieldError = validateFields(fields);
        if (fieldError) return res.status(400).json({ success: false, message: fieldError });

        const template = await Template.create({
            advocateId,
            advocateName: advocate.fullName,
            practiceArea: practiceArea.trim(),
            category: category.trim(),
            caseType: caseType.trim(),
            title: title.trim(),
            description: description?.trim() || "",
            fields: formatFields(fields),
        });

        return res.status(201).json({
            success: true,
            message: "Template created successfully",
            data: { ...template.toObject(), fields: cleanFieldsForResponse(template.fields) },
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── GET TEMPLATES ────────────────────────────────────────────
const getTemplates = async (req, res) => {
    try {
        const advocateId = req.advocate._id;
        const { practiceArea, category, caseType, isActive, page = 1, limit = 10 } = req.query;

        const filter = { advocateId };
        if (practiceArea?.trim()) filter.practiceArea = practiceArea.trim();
        if (category?.trim()) filter.category = category.trim();
        if (caseType?.trim()) filter.caseType = caseType.trim();
        if (isActive !== undefined) filter.isActive = isActive === "true";

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [templates, total] = await Promise.all([
            Template.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).select("-__v"),
            Template.countDocuments(filter),
        ]);

        const data = templates.map((t) => ({
            ...t.toObject(),
            fields: cleanFieldsForResponse(t.fields),
        }));

        return res.status(200).json({
            success: true,
            data,
            pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── EDIT TEMPLATE ────────────────────────────────────────────
const editTemplate = async (req, res) => {
    try {
        const { templateId } = req.params;
        const advocateId = req.advocate._id;

        if (!mongoose.Types.ObjectId.isValid(templateId))
            return res.status(400).json({ success: false, message: "Invalid template ID" });

        const template = await Template.findOne({ _id: templateId, advocateId });
        if (!template) return res.status(404).json({ success: false, message: "Template not found" });

        const { practiceArea, category, caseType, title, description, fields, isActive } = req.body;

        if (practiceArea !== undefined) {
            if (!practiceArea?.trim()) return res.status(400).json({ success: false, message: "Practice area cannot be empty" });
            template.practiceArea = practiceArea.trim();
        }

        if (category !== undefined) {
            if (!category?.trim()) return res.status(400).json({ success: false, message: "Category cannot be empty" });
            template.category = category.trim();
        }

        const newCaseType = caseType !== undefined ? caseType.trim() : template.caseType;
        const newTitle = title !== undefined ? title.trim() : template.title;

        if (caseType !== undefined && !caseType?.trim()) return res.status(400).json({ success: false, message: "Case type empty" });
        if (title !== undefined && !title?.trim()) return res.status(400).json({ success: false, message: "Title empty" });

        if (caseType !== undefined || title !== undefined) {
            const duplicate = await Template.findOne({
                advocateId,
                caseType: newCaseType,
                title: newTitle,
                isActive: true,
                _id: { $ne: templateId },
            });
            if (duplicate) return res.status(409).json({ success: false, message: "Duplicate title/caseType" });
        }

        template.caseType = newCaseType;
        template.title = newTitle;

        if (description !== undefined) template.description = description?.trim() || "";
        if (isActive !== undefined) template.isActive = Boolean(isActive);

        if (fields !== undefined) {
            if (!Array.isArray(fields) || fields.length === 0) return res.status(400).json({ success: false, message: "Fields required" });
            const fieldError = validateFields(fields);
            if (fieldError) return res.status(400).json({ success: false, message: fieldError });

            const existingNames = new Set(template.fields.map((f) => f.fieldName.toLowerCase()));
            const newFields = formatFields(fields).filter((f) => !existingNames.has(f.fieldName.toLowerCase()));

            if (newFields.length === 0) return res.status(400).json({ success: false, message: "Fields already exist" });
            template.fields = [...template.fields, ...newFields];
        }

        await template.save();
        return res.status(200).json({
            success: true,
            message: "Template updated successfully",
            data: { ...template.toObject(), fields: cleanFieldsForResponse(template.fields) },
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const getTemplateById = async (req, res) => {
    try {
        const { templateId } = req.params;
        const advocateId = req.advocate._id;
        if (!mongoose.Types.ObjectId.isValid(templateId)) return res.status(400).json({ success: false, message: "Invalid ID" });

        const template = await Template.findOne({ _id: templateId, advocateId }).select("-__v");
        if (!template) return res.status(404).json({ success: false, message: "Not found" });

        return res.status(200).json({
            success: true,
            data: { ...template.toObject(), fields: cleanFieldsForResponse(template.fields) },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error" });
    }
};

const deleteTemplate = async (req, res) => {
    try {
        const { templateId } = req.params;
        const advocateId = req.advocate._id;
        const template = await Template.findOneAndDelete({ _id: templateId, advocateId });
        if (!template) return res.status(404).json({ success: false, message: "Not found" });
        return res.status(200).json({ success: true, message: "Deleted" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error" });
    }
};

module.exports = { createTemplate, getTemplates, getTemplateById, editTemplate, deleteTemplate };