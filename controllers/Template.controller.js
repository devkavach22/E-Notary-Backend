const mongoose = require("mongoose");
const Template = require("../models/Template");
const Advocate = require("../models/Advocate");
const UserFilledTemplate = require("../models/UserFilledTemplate");
const VALID_FIELD_TYPES = ["text", "number", "date", "textarea", "image", "file", "dropdown"];
const { sendTemplateAcceptedEmail, sendTemplateRejectedEmail } = require("./sendOTP");

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

const validateFields = (fields, partyLabel = "") => {
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const prefix = partyLabel ? `Party "${partyLabel}", Field ${i + 1}` : `Field ${i + 1}`;
    if (!field.fieldName?.trim()) return `${prefix}: fieldName is required`;
    if (!field.fieldType) return `${prefix} "${field.fieldName}": fieldType is required`;
    if (!VALID_FIELD_TYPES.includes(field.fieldType))
      return `${prefix} "${field.fieldName}": Invalid fieldType.`;
    if (field.fieldType === "dropdown") {
      if (!field.options || !Array.isArray(field.options) || field.options.length === 0)
        return `${prefix} "${field.fieldName}" (dropdown) requires options`;
    }
  }
  return null;
};

const validateParties = (parties) => {
  for (let i = 0; i < parties.length; i++) {
    const party = parties[i];
    if (!party.partyName?.trim()) return `Party ${i + 1}: partyName is required`;
    if (!Array.isArray(party.fields) || party.fields.length === 0)
      return `Party "${party.partyName}": at least one field is required`;

    const fieldError = validateFields(party.fields, party.partyName);
    if (fieldError) return fieldError;
  }

  // Duplicate party name check
  const names = parties.map((p) => p.partyName.trim().toLowerCase());
  const hasDupe = names.some((n, i) => names.indexOf(n) !== i);
  if (hasDupe) return "Duplicate party names are not allowed";

  return null;
};

const formatParties = (parties) =>
  parties.map((p) => ({
    partyName: p.partyName.trim(),
    fields: formatFields(p.fields),
  }));

const cleanPartiesForResponse = (parties) =>
  parties.map((p) => ({
    partyName: p.partyName,
    fields: cleanFieldsForResponse(p.fields),
  }));


// ── CREATE TEMPLATE ──────────────────────────────────────────
const createTemplate = async (req, res) => {
  try {
    const { practiceArea, category, title, description, templateLayout, parties, fields } = req.body;
    const advocateId = req.advocate._id;

    const advocate = await Advocate.findById(advocateId).select("fullName approvalStatus isActive practiceAreas categories");
    if (!advocate) return res.status(404).json({ success: false, message: "Advocate not found" });

    if (advocate.approvalStatus !== "approved" || !advocate.isActive)
      return res.status(403).json({ success: false, message: "Unauthorized advocate" });

    // ── Required field checks ───────────────────────────
    if (!practiceArea?.trim()) return res.status(400).json({ success: false, message: "Practice area is required" });
    if (!category?.trim()) return res.status(400).json({ success: false, message: "Category is required" });
    if (!title?.trim()) return res.status(400).json({ success: false, message: "Template title is required" });

    // ── Advocate practiceArea validation ────────────────
    if (!advocate.practiceAreas.includes(practiceArea.trim())) {
      return res.status(403).json({
        success: false,
        message: `You are not registered for practice area: "${practiceArea}". Your areas: ${advocate.practiceAreas.join(", ")}`,
      });
    }

    // ── Advocate category validation ────────────────────
    if (!advocate.categories.includes(category.trim())) {
      return res.status(403).json({
        success: false,
        message: `You are not registered for category: "${category}". Your categories: ${advocate.categories.join(", ")}`,
      });
    }

    // ── Duplicate check ─────────────────────────────────
    const existing = await Template.findOne({ advocateId, title: title.trim(), isActive: true });
    if (existing) return res.status(409).json({ success: false, message: "Template with this title already exists" });

    // ── Determine mode: parties or flat fields ──────────
    const hasParties = Array.isArray(parties) && parties.length > 0;
    const hasFields = Array.isArray(fields) && fields.length > 0;

    if (hasParties) {
      const partyError = validateParties(parties);
      if (partyError) return res.status(400).json({ success: false, message: partyError });
    }

    if (hasFields) {
      const fieldError = validateFields(fields);
      if (fieldError) return res.status(400).json({ success: false, message: fieldError });
    }

    const template = await Template.create({
      advocateId,
      advocateName: advocate.fullName,
      practiceArea: practiceArea.trim(),
      category: category.trim(),
      title: title.trim(),
      description: description?.trim() || "",
      templateLayout: templateLayout || "",
      parties: hasParties ? formatParties(parties) : [],
      fields: hasFields ? formatFields(fields) : [],
    });

    return res.status(201).json({
      success: true,
      message: "Template created successfully",
      data: {
        ...template.toObject(),
        parties: cleanPartiesForResponse(template.parties),
        fields: cleanFieldsForResponse(template.fields),
      },
    });

  } catch (error) {
    console.error("createTemplate Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── GET TEMPLATES ────────────────────────────────────────────
const getTemplates = async (req, res) => {
  try {
    const advocateId = req.advocate._id;
    const { practiceArea, category, isActive, page = 1, limit = 10 } = req.query;

    const filter = { advocateId };
    if (practiceArea?.trim()) filter.practiceArea = practiceArea.trim();
    if (category?.trim()) filter.category = category.trim();
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [templates, total] = await Promise.all([
      Template.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).select("-__v"),
      Template.countDocuments(filter),
    ]);

    const data = templates.map((t) => ({
      ...t.toObject(),
      parties: cleanPartiesForResponse(t.parties),  // ← changed from fields
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

// ── EDIT TEMPLATE ────────────────────────────────────────────
const editTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const advocateId = req.advocate._id;

    console.log("═══════════════════════════════════════════");
    console.log("📥 editTemplate HIT");
    console.log("📌 templateId (params)  :", templateId);
    console.log("📦 req.body             :", JSON.stringify(req.body, null, 2));
    console.log("📝 practiceArea         :", req.body.practiceArea);
    console.log("📝 category             :", req.body.category);
    console.log("📝 title                :", req.body.title);
    console.log("📝 description          :", req.body.description);
    console.log("📝 isActive             :", req.body.isActive);
    console.log("📝 templateLayout       :", req.body.templateLayout);
    console.log("👥 parties              :", JSON.stringify(req.body.parties, null, 2));
    console.log("📋 fields               :", JSON.stringify(req.body.fields, null, 2));
    console.log("═══════════════════════════════════════════");

    if (!mongoose.Types.ObjectId.isValid(templateId))
      return res.status(400).json({ success: false, message: "Invalid template ID" });

    const advocate = await Advocate.findById(advocateId).select("practiceAreas categories");
    if (!advocate) return res.status(404).json({ success: false, message: "Advocate not found" });

    const template = await Template.findOne({ _id: templateId, advocateId });
    if (!template) return res.status(404).json({ success: false, message: "Template not found" });

    console.log("📂 Existing template from DB:");
    console.log("   title          :", template.title);
    console.log("   practiceArea   :", template.practiceArea);
    console.log("   category       :", template.category);
    console.log("   templateLayout :", template.templateLayout);
    console.log("   parties        :", JSON.stringify(template.parties, null, 2));
    console.log("   fields         :", JSON.stringify(template.fields, null, 2));
    console.log("═══════════════════════════════════════════");

    const { practiceArea, category, title, description, parties, fields, isActive, templateLayout } = req.body;

    if (practiceArea !== undefined) {
      if (!practiceArea?.trim()) return res.status(400).json({ success: false, message: "Practice area cannot be empty" });

      if (!advocate.practiceAreas.includes(practiceArea.trim())) {
        return res.status(403).json({
          success: false,
          message: `You are not registered for practice area: "${practiceArea}". Your areas: ${advocate.practiceAreas.join(", ")}`,
        });
      }
      template.practiceArea = practiceArea.trim();
    }

    if (category !== undefined) {
      if (!category?.trim()) return res.status(400).json({ success: false, message: "Category cannot be empty" });

      if (!advocate.categories.includes(category.trim())) {
        return res.status(403).json({
          success: false,
          message: `You are not registered for category: "${category}". Your categories: ${advocate.categories.join(", ")}`,
        });
      }
      template.category = category.trim();
    }

    if (title !== undefined) {
      if (!title?.trim()) return res.status(400).json({ success: false, message: "Title cannot be empty" });

      const duplicate = await Template.findOne({
        advocateId,
        title: title.trim(),
        isActive: true,
        _id: { $ne: templateId },
      });
      if (duplicate) return res.status(409).json({ success: false, message: "Template with this title already exists" });

      template.title = title.trim();
    }

    if (description !== undefined) template.description = description?.trim() || "";
    if (isActive !== undefined) template.isActive = Boolean(isActive);

    // ── Parties update ──────────────────────────────────
    if (parties !== undefined) {
      console.log("🔄 Processing parties update...");
      const partyError = validateParties(parties);
      if (partyError) return res.status(400).json({ success: false, message: partyError });

      const existingPartyNames = new Set(template.parties.map((p) => p.partyName.toLowerCase()));

      for (const incomingParty of formatParties(parties)) {
        const partyNameKey = incomingParty.partyName.toLowerCase();

        if (existingPartyNames.has(partyNameKey)) {
          console.log(`   ✅ Party "${incomingParty.partyName}" exists → merging new fields`);
          const existingParty = template.parties.find(
            (p) => p.partyName.toLowerCase() === partyNameKey
          );
          const existingFieldNames = new Set(existingParty.fields.map((f) => f.fieldName.toLowerCase()));
          const newFields = incomingParty.fields.filter((f) => !existingFieldNames.has(f.fieldName.toLowerCase()));
          console.log(`   ➕ New fields added to "${incomingParty.partyName}":`, newFields.map((f) => f.fieldName));
          existingParty.fields = [...existingParty.fields, ...newFields];
        } else {
          console.log(`   🆕 New party "${incomingParty.partyName}" → adding entirely`);
          template.parties.push(incomingParty);
        }
      }
    }

    // ── Top-level fields update ─────────────────────────
    if (fields !== undefined) {
      console.log("🔄 Processing fields update...");
      if (Array.isArray(fields) && fields.length > 0) {
        const fieldError = validateFields(fields);
        if (fieldError) return res.status(400).json({ success: false, message: fieldError });

        const existingFieldNames = new Set(template.fields.map((f) => f.fieldName.toLowerCase()));
        const newFields = formatFields(fields).filter((f) => !existingFieldNames.has(f.fieldName.toLowerCase()));
        console.log("   ➕ New fields added:", newFields.map((f) => f.fieldName));
        template.fields = [...template.fields, ...newFields];
      } else {
        // empty array sent → clear fields
        template.fields = [];
      }
    }

    // ── Template layout update ──────────────────────────
    if (templateLayout !== undefined) {
      console.log("🖊️  templateLayout received → saving...");
      console.log("   layout value:", templateLayout);
      template.templateLayout = templateLayout?.trim() || "";
    }

    await template.save();

    console.log("✅ Template saved successfully");
    console.log("═══════════════════════════════════════════");

    return res.status(200).json({
      success: true,
      message: "Template updated successfully",
      data: {
        ...template.toObject(),
        parties: cleanPartiesForResponse(template.parties),
        fields: cleanFieldsForResponse(template.fields),
      },
    });

  } catch (error) {
    console.error("❌ editTemplate Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
// ── GET TEMPLATE BY ID ───────────────────────────────────────
const getTemplateById = async (req, res) => {
  try {
    const { templateId } = req.params;
    const advocateId = req.advocate._id;

    if (!mongoose.Types.ObjectId.isValid(templateId))
      return res.status(400).json({ success: false, message: "Invalid template ID" });

    const template = await Template.findOne({ _id: templateId, advocateId }).select("-__v");
    if (!template) return res.status(404).json({ success: false, message: "Template not found" });

    return res.status(200).json({
      success: true,
      data: { ...template.toObject(), fields: cleanFieldsForResponse(template.fields) },
    });
  } catch (error) {
    console.error("getTemplateById Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── DELETE TEMPLATE ──────────────────────────────────────────
const deleteTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const advocateId = req.advocate._id;

    if (!mongoose.Types.ObjectId.isValid(templateId))
      return res.status(400).json({ success: false, message: "Invalid template ID" });

    const template = await Template.findOneAndDelete({ _id: templateId, advocateId });
    if (!template) return res.status(404).json({ success: false, message: "Template not found" });

    return res.status(200).json({ success: true, message: "Template deleted successfully" });
  } catch (error) {
    console.error("deleteTemplate Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── GET FILLED TEMPLATES (Advocate) ─────────────────────────
const getFilledTemplates = async (req, res) => {
  try {
    const advocateId = req.advocate._id;
    const { templateId, page = 1, limit = 10 } = req.query;

    const filter = { advocateId };
    if (templateId) {
      if (!mongoose.Types.ObjectId.isValid(templateId))
        return res.status(400).json({ success: false, message: "Invalid template ID" });
      filter.templateId = templateId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [submissions, total] = await Promise.all([
      UserFilledTemplate.find(filter)
        .populate("userId", "fullName email mobile")
        .populate("templateId", "title practiceArea category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select("-__v"),
      UserFilledTemplate.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: submissions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    console.error("getFilledTemplates Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
const acceptSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const advocateId = req.advocate._id;

    if (!mongoose.Types.ObjectId.isValid(submissionId))
      return res.status(400).json({ success: false, message: "Invalid submission ID" });

    const submission = await UserFilledTemplate.findOne({ _id: submissionId, advocateId })
      .populate("userId", "fullName email")
      .populate("templateId", "title");

    if (!submission)
      return res.status(404).json({ success: false, message: "Submission not found" });

    if (submission.status !== "submitted")
      return res.status(400).json({
        success: false,
        message: `Submission is already ${submission.status}`,
      });

    submission.status = "accepted";
    submission.rejectionReason = null;
    await submission.save();

    // Send acceptance email to user (non-blocking)
    try {
      if (submission.userId?.email) {
        await sendTemplateAcceptedEmail({
          userEmail: submission.userId.email,
          userName: submission.userId.fullName,
          advocateName: req.advocate.fullName,
          templateTitle: submission.title,
          practiceArea: submission.practiceArea,
          category: submission.category,
          submissionId: submission._id.toString(),
        });
        console.log("✅ Acceptance email sent to user:", submission.userId.email);
      }
    } catch (emailErr) {
      console.warn("⚠️ Acceptance email failed (non-blocking):", emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Submission accepted successfully",
      data: { submissionId: submission._id, status: submission.status },
    });
  } catch (error) {
    console.error("acceptSubmission Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── REJECT SUBMISSION ────────────────────────────────────────
const rejectSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { reason } = req.body; // ✅ body se lo
    const advocateId = req.advocate._id;

    if (!mongoose.Types.ObjectId.isValid(submissionId))
      return res.status(400).json({ success: false, message: "Invalid submission ID" });

    if (!reason?.trim())
      return res.status(400).json({ success: false, message: "Rejection reason is required" });

    if (reason.trim().length > 500)
      return res.status(400).json({ success: false, message: "Reason must not exceed 500 characters" });

    const submission = await UserFilledTemplate.findOne({ _id: submissionId, advocateId })
      .populate("userId", "fullName email")
      .populate("templateId", "title");

    if (!submission)
      return res.status(404).json({ success: false, message: "Submission not found" });

    if (submission.status !== "submitted")
      return res.status(400).json({
        success: false,
        message: `Submission is already ${submission.status}`,
      });

    submission.status = "rejected";
    submission.rejectionReason = reason.trim(); // ✅ body wala reason save hoga
    await submission.save();

    try {
      if (submission.userId?.email) {
        await sendTemplateRejectedEmail({
          userEmail: submission.userId.email,
          userName: submission.userId.fullName,
          advocateName: req.advocate.fullName,
          templateTitle: submission.title,
          practiceArea: submission.practiceArea,
          category: submission.category,
          submissionId: submission._id.toString(),
          reason: reason.trim(), // ✅ same reason email mein bhi
        });
        console.log("✅ Rejection email sent to user:", submission.userId.email);
      }
    } catch (emailErr) {
      console.warn("⚠️ Rejection email failed (non-blocking):", emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Submission rejected successfully",
      data: {
        submissionId: submission._id,
        status: submission.status,
        rejectionReason: submission.rejectionReason,
      },
    });
  } catch (error) {
    console.error("rejectSubmission Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
// ── Date Helper ──────────────────────────────────────────────
const formatDate = (date) => new Date(date).toISOString().split("T")[0];

// ── ADVOCATE DASHBOARD ───────────────────────────────────────
const getAdvocateDashboard = async (req, res) => {
  try {
    const advocateId = req.advocate._id;

    const [
      totalTemplates,
      totalUsers,
      pendingSubmissions,
      acceptedSubmissions,
      rejectedSubmissions,
      advocate,
    ] = await Promise.all([
      Template.countDocuments({ advocateId }),
      UserFilledTemplate.distinct("userId", { advocateId }),
      UserFilledTemplate.find({ advocateId, status: "submitted" })
        .populate("userId", "fullName")
        .select("title practiceArea category userId createdAt")
        .sort({ createdAt: -1 }),
      UserFilledTemplate.find({ advocateId, status: "accepted" })
        .populate("userId", "fullName")
        .select("title practiceArea category userId createdAt updatedAt")
        .sort({ updatedAt: -1 }),
      UserFilledTemplate.find({ advocateId, status: "rejected" })
        .populate("userId", "fullName")
        .select("title practiceArea category userId rejectionReason createdAt updatedAt")
        .sort({ updatedAt: -1 }),
      Advocate.findById(advocateId).select("fullName createdAt"),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        advocate: {
          name: advocate.fullName,
          joinDate: formatDate(advocate.createdAt), // ✅
        },
        stats: {
          totalTemplates: totalTemplates,
          totalUsers: totalUsers.length,
          totalPending: pendingSubmissions.length,
          totalAccepted: acceptedSubmissions.length,
          totalRejected: rejectedSubmissions.length,
        },
        pending: pendingSubmissions.map((s) => ({
          submissionId: s._id,
          title: s.title,
          practiceArea: s.practiceArea,
          category: s.category,
          userName: s.userId?.fullName || "N/A",
          submitDate: formatDate(s.createdAt), // ✅
        })),
        accepted: acceptedSubmissions.map((s) => ({
          submissionId: s._id,
          title: s.title,
          practiceArea: s.practiceArea,
          category: s.category,
          userName: s.userId?.fullName || "N/A",
          submitDate: formatDate(s.createdAt), // ✅
          acceptDate: formatDate(s.updatedAt), // ✅
        })),
        rejected: rejectedSubmissions.map((s) => ({
          submissionId: s._id,
          title: s.title,
          practiceArea: s.practiceArea,
          category: s.category,
          userName: s.userId?.fullName || "N/A",
          rejectionReason: s.rejectionReason,
          submitDate: formatDate(s.createdAt), // ✅
          rejectedDate: formatDate(s.updatedAt), // ✅
        })),
      },
    });
  } catch (error) {
    console.error("getAdvocateDashboard Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { createTemplate, getTemplates, getTemplateById, editTemplate, deleteTemplate, getFilledTemplates, acceptSubmission, rejectSubmission, getAdvocateDashboard };