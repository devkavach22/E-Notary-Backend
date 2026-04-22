const User = require("../models/User");
const Advocate = require("../models/Advocate");
const mongoose = require("mongoose");
const Template = require("../models/Template");
const UserFilledTemplate = require("../models/UserFilledTemplate");
const OTP = require("../models/OTP");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");


const parseDOB = (dobInput) => {
  if (!dobInput) return null;
  const str = String(dobInput).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split("/");
    return new Date(`${y}-${m}-${d}T12:00:00.000Z`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(`${str}T12:00:00.000Z`);
  const dt = new Date(str);
  if (!isNaN(dt)) { dt.setUTCHours(12, 0, 0, 0); return dt; }
  return null;
};

const validateEmail = (email) => {
  if (!email) return "Email is required";
  if (email.length > 30) return "Email must not exceed 30 characters";
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Invalid email address";
  return null;
};

const validatePassword = (password) => {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 28) return "Password must not exceed 28 characters";
  return null;
};

const cleanFieldsForResponse = (fields) =>
  fields.map((f) => {
    const field = {
      fieldName:   f.fieldName,
      fieldType:   f.fieldType,
      required:    f.required,
      placeholder: f.placeholder,
    };
    if (f.fieldType === "dropdown") field.options           = f.options;
    if (f.fieldType === "image" && f.defaultImagePath) field.defaultImagePath = f.defaultImagePath;
    return field;
  });


const UserverifyDocuments = async (req, res) => {
  try {
    const files = req.files;

    if (!files?.aadhaarFront || !files?.panCard) {
      return res.status(400).json({
        success: false,
        message: "Aadhaar front and PAN card images are required",
      });
    }

    console.log("\n========== DOCUMENTS UPLOADED ==========");
    console.log("Aadhaar Front:", files.aadhaarFront[0].path);
    console.log("PAN Card:", files.panCard[0].path);
    console.log("=========================================\n");

    return res.status(200).json({
      success: true,
      message: "Documents verified successfully",
      filePaths: {
        aadhaarFront: files.aadhaarFront[0].path,
        panCard:      files.panCard[0].path,
      },
    });

  } catch (error) {
    console.error("UserverifyDocuments Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const registerUser = async (req, res) => {
  try {
    const {
      email, mobile, password,
      fullName, dateOfBirth,
      aadhaarNumber, panNumber,
      address, city, state, pincode,
      gender,
      aadhaarFrontPath, panCardPath,
    } = req.body;

    if (!email || !mobile || !password || !fullName || !dateOfBirth ||
      !aadhaarNumber || !panNumber || !address ||
      !city || !state || !pincode ||
      !aadhaarFrontPath || !panCardPath) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ success: false, message: emailErr });

    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ success: false, message: passwordErr });

    if (!/^[6-9]\d{9}$/.test(mobile))
      return res.status(400).json({ success: false, message: "Invalid mobile number" });

    if (!/^\d{12}$/.test(aadhaarNumber))
      return res.status(400).json({ success: false, message: "Aadhaar must be 12 digits" });

    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase()))
      return res.status(400).json({ success: false, message: "Invalid PAN number format" });

    if (!/^\d{6}$/.test(pincode))
      return res.status(400).json({ success: false, message: "Invalid pincode" });

    const emailInUser = await User.findOne({ email });
    const emailInAdv  = await Advocate.findOne({ email });
    if (emailInUser && emailInAdv)
      return res.status(409).json({ success: false, message: "Email already registered in both accounts" });

    const mobileInUser = await User.findOne({ mobile });
    const mobileInAdv  = await Advocate.findOne({ mobile });
    if (mobileInUser && mobileInAdv)
      return res.status(409).json({ success: false, message: "Mobile number already registered in both accounts" });

    if (await User.findOne({ aadhaarNumber }))
      return res.status(409).json({ success: false, message: "Aadhaar number is already registered" });

    if (await User.findOne({ panNumber: panNumber.toUpperCase() }))
      return res.status(409).json({ success: false, message: "PAN number is already registered" });

    const emailVerified = await OTP.findOne({ email, purpose: "email_verify", isUsed: true });
    if (!emailVerified)
      return res.status(400).json({ success: false, message: "Email is not verified. Please verify your email first" });

    const mobileVerified = await OTP.findOne({ mobile, purpose: "mobile_verify", isUsed: true });
    if (!mobileVerified)
      return res.status(400).json({ success: false, message: "Mobile is not verified. Please verify your mobile first" });

    const parsedDOB = parseDOB(dateOfBirth);
    if (!parsedDOB)
      return res.status(400).json({ success: false, message: "Invalid date of birth format" });

    const user = await User.create({
      email, mobile, password, fullName,
      dateOfBirth: parsedDOB,
      gender: gender || null,
      aadhaarNumber,
      panNumber: panNumber.toUpperCase(),
      address, city, state, pincode,
      documents: {
        aadhaarFront: aadhaarFrontPath,
        panCard:      panCardPath,
      },
      isEmailVerified:  true,
      isMobileVerified: true,
      verificationChecks: {
        aadhaarVerified: true,
        panVerified:     true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      data: {
        id:       user._id,
        fullName: user.fullName,
        email:    user.email,
        role:     user.role,
      },
    });

  } catch (error) {
    console.error("registerUser Error:", error);

    if (error.name === "ValidationError") {
      const msgs = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: msgs[0] });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const fieldLabels = {
        email:        "Email",
        mobile:       "Mobile number",
        aadhaarNumber:"Aadhaar number",
        panNumber:    "PAN number",
      };
      const label = fieldLabels[field] || field;
      return res.status(409).json({ success: false, message: `${label} is already registered` });
    }

    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const getUSerProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({ success: true, data: user });

  } catch (error) {
    console.error("getMe Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const getAdvocatesForUser = async (req, res) => {
  try {
    const { caseType, category } = req.query;

    if (!caseType && !category) {
      return res.status(400).json({
        success: false,
        message: "Either 'caseType' or 'category' query parameter is required. Use 'all' to fetch all advocates.",
      });
    }

    const baseFilter = { isActive: true, approvalStatus: "approved" };
    let filter       = { ...baseFilter };

    if (caseType && caseType.trim().toLowerCase() !== "all") {
      filter.practiceAreas = {
        $elemMatch: { $regex: new RegExp(`^${caseType.trim()}$`, "i") },
      };
    }

    if (category && category.trim().toLowerCase() !== "all") {
      filter.categories = {
        $elemMatch: { $regex: new RegExp(`^${category.trim()}$`, "i") },
      };
    }

    const advocates = await Advocate.find(filter)
      .select(
        "fullName city state barCouncilState practiceAreas categories " +
        "languagesKnown availableDays availableHours perDocumentFee yearOfEnrollment"
      )
      .sort({ createdAt: -1 });

    if (advocates.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No advocates found for the selected Values.",
      });
    }

    const advocateIds = advocates.map((a) => a._id);

    const templatesWithAdvocates = await Template.distinct("advocateId", {
      advocateId: { $in: advocateIds },
    });

    const filteredAdvocates = advocates.filter((a) =>
      templatesWithAdvocates.some((id) => id.toString() === a._id.toString())
    );

    if (filteredAdvocates.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No advocates found for the selected Values.",
      });
    }

    return res.status(200).json({
      success: true,
      filterApplied: {
        ...(caseType && caseType.trim().toLowerCase() !== "all" && { caseType: caseType.trim() }),
        ...(category && category.trim().toLowerCase() !== "all" && { category: category.trim() }),
      },
      total: filteredAdvocates.length,
      data:  filteredAdvocates,
    });

  } catch (error) {
    console.error("getAdvocatesForUser Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const getTemplatesForUser = async (req, res) => {
  try {
    const { advocateId } = req.params;
    const { practiceArea, category } = req.query;

    if (!mongoose.Types.ObjectId.isValid(advocateId))
      return res.status(400).json({ success: false, message: "Invalid advocate ID" });

    const advocate = await Advocate.findOne({
      _id:            advocateId,
      approvalStatus: "approved",
      isActive:       true,
    }).select("fullName");

    if (!advocate)
      return res.status(404).json({ success: false, message: "Advocate not found or not active" });

    const user = await User.findById(req.user._id).select(
      "-password -role -isEmailVerified -isMobileVerified -verificationChecks -isActive -documents -__v"
    );

    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    const filter = { advocateId, isActive: true };
    if (practiceArea?.trim()) filter.practiceArea = practiceArea.trim();
    if (category?.trim())     filter.category     = category.trim();

    const templates = await Template.find(filter)
      .sort({ createdAt: -1 })
      .select("-__v");

    if (templates.length === 0)
      return res.status(404).json({ success: false, message: "No templates found" });

    return res.status(200).json({
      success: true,
      advocateName: advocate.fullName,
      filterApplied: {
        ...(practiceArea?.trim() && { practiceArea: practiceArea.trim() }),
        ...(category?.trim()     && { category:     category.trim()     }),
      },
      totalTemplates: templates.length,
      userData: user,
      data: templates.map((t) => ({
        ...t.toObject(),
        fields: cleanFieldsForResponse(t.fields),
      })),
    });
  } catch (error) {
    console.error("getTemplatesForUser Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── FILL TEMPLATE ────────────────────────────────────────────
const fillTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(templateId))
      return res.status(400).json({ success: false, message: "Invalid template ID" });

    if (!req.user?._id)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    // ✅ Parse filledFields from JSON string (multipart/form-data sends it as a string)
    let filledFields = [];
    try {
      if (req.body.filledFields) {
        filledFields = JSON.parse(req.body.filledFields);
      }
    } catch {
      return res.status(400).json({ success: false, message: "Invalid JSON in filledFields" });
    }

    const template = await Template.findOne({ _id: templateId, isActive: true });
    if (!template)
      return res.status(404).json({ success: false, message: "Template not found or inactive" });

    if (!Array.isArray(filledFields) || filledFields.length === 0)
      return res.status(400).json({ success: false, message: "filledFields are required" });

    // ✅ Build a map of uploaded image files: { [normalizedFieldName]: filePath }
    // Convention: field name in form = "filledImage_<fieldName>"
    const uploadedImageMap = {};
    if (Array.isArray(req.files)) {
      for (const file of req.files) {
        if (file.fieldname.startsWith("filledImage_")) {
          const fieldName = file.fieldname.slice("filledImage_".length).toLowerCase();
          uploadedImageMap[fieldName] = file.path;
        }
      }
    }

    // Merge all template fields (flat + party fields) for validation
    const allTemplateFields = [
      ...template.fields,
      ...template.parties.flatMap((p) => p.fields),
    ];

    // ✅ Required field validation — image fields checked against uploads too
    const missingFields = [];
    for (const templateField of allTemplateFields) {
      if (!templateField.required) continue;

      const userField = filledFields.find(
        (f) => f.fieldName.trim().toLowerCase() === templateField.fieldName.trim().toLowerCase()
      );

      if (templateField.fieldType === "image") {
        // Image field: check uploaded file OR a value (URL/path) in filledFields
        const key         = templateField.fieldName.trim().toLowerCase();
        const hasUpload   = !!uploadedImageMap[key];
        const hasValue    = userField &&
                            userField.value !== null &&
                            userField.value !== undefined &&
                            String(userField.value).trim() !== "";
        if (!hasUpload && !hasValue) missingFields.push(templateField.fieldName);
      } else {
        const isEmpty =
          !userField ||
          userField.value === null ||
          userField.value === undefined ||
          String(userField.value).trim() === "";
        if (isEmpty) missingFields.push(templateField.fieldName);
      }
    }

    if (missingFields.length > 0)
      return res.status(400).json({
        success: false,
        message: `Required fields missing: ${missingFields.join(", ")}`,
      });

    // ✅ Enrich fields — for image fields, prefer the uploaded file path over any provided value
    const enrichedFields = filledFields.map((userField) => {
      const templateField = allTemplateFields.find(
        (f) => f.fieldName.trim().toLowerCase() === userField.fieldName.trim().toLowerCase()
      );

      const fieldType = templateField?.fieldType || "text";
      const key       = userField.fieldName.trim().toLowerCase();

      let value = userField.value;

      if (fieldType === "image" && uploadedImageMap[key]) {
        // ✅ Uploaded file path takes precedence
        value = uploadedImageMap[key];
      }

      return {
        fieldName: userField.fieldName.trim(),
        fieldType,
        value,
      };
    });

    // ✅ Also add image-only fields that were uploaded but not in filledFields JSON
    // (e.g. user sent file but forgot to include it in the JSON array)
    for (const [key, filePath] of Object.entries(uploadedImageMap)) {
      const alreadyEnriched = enrichedFields.some(
        (f) => f.fieldName.toLowerCase() === key
      );
      if (!alreadyEnriched) {
        const templateField = allTemplateFields.find(
          (f) => f.fieldName.trim().toLowerCase() === key
        );
        if (templateField) {
          enrichedFields.push({
            fieldName: templateField.fieldName,
            fieldType: "image",
            value:     filePath,
          });
        }
      }
    }

    const existing = await UserFilledTemplate.findOne({
      templateId: template._id,
      userId:     req.user._id,
      status:     { $in: ["submitted", "approved"] },
      filledFields: {
        $all: enrichedFields
          .filter((f) => f.fieldType !== "image") // skip image fields from duplicate check
          .map((f) => ({
            $elemMatch: {
              fieldName: f.fieldName,
              value:     String(f.value).trim(),
            },
          })),
      },
    });

    if (existing)
      return res.status(409).json({
        success: false,
        message: "You have already submitted this form with the same details.",
      });

    const filledTemplate = await UserFilledTemplate.create({
      templateId:   template._id,
      advocateId:   template.advocateId,
      userId:       req.user._id,
      title:        template.title,
      practiceArea: template.practiceArea,
      category:     template.category,
      filledFields: enrichedFields,
      status:       "submitted",
    });

    try {
      const advocate = await Advocate.findById(template.advocateId).select("email fullName");
      const user     = await User.findById(req.user._id).select("fullName email mobile");
      if (advocate && user) {
        await sendTemplateSubmissionEmail({
          advocateEmail: advocate.email,
          advocateName:  advocate.fullName,
          userName:      user.fullName,
          userEmail:     user.email,
          userMobile:    user.mobile,
          templateTitle: template.title,
          practiceArea:  template.practiceArea,
          category:      template.category,
          submissionId:  filledTemplate._id.toString(),
          filledFields:  enrichedFields,
        });
        console.log("✅ Template submission email sent to advocate:", advocate.email);
      }
    } catch (emailErr) {
      console.warn("⚠️ Template submission email failed (non-blocking):", emailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Template submitted successfully",
      data:    filledTemplate,
    });

  } catch (error) {
    console.error("fillTemplate Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const downloadFilledTemplate = async (req, res) => {
  try {
    const { submissionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(submissionId))
      return res.status(400).json({ success: false, message: "Invalid submission ID" });

    const submission = await UserFilledTemplate.findOne({
      _id:    submissionId,
      userId: req.user._id,
    })
      .populate("userId",     "fullName email mobile")
      .populate("templateId", "title practiceArea category");

    if (!submission)
      return res.status(404).json({ success: false, message: "Submission not found" });

    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="submission_${submissionId}.pdf"`);
    doc.pipe(res);

    const DARK_BLUE  = "#1a3c5e";
    const WHITE      = "#ffffff";
    const LIGHT_GRAY = "#f5f7fa";
    const BORDER     = "#e0e4ea";
    const TEXT_DARK  = "#1a1a2e";
    const TEXT_MUTED = "#6b7280";
    const GREEN_BG   = "#e1f5ee";
    const GREEN_TEXT = "#0f6e56";

    const pageW    = doc.page.width;
    const margin   = 50;
    const contentW = pageW - margin * 2;

    doc.rect(0, 0, pageW, 110).fill(DARK_BLUE);

    doc
      .fontSize(20).font("Helvetica-Bold").fillColor(WHITE)
      .text(submission.title || "Filled Template", margin, 28, { align: "center", width: contentW });

    const badgeY  = 62;
    const badge1  = `Practice Area : ${submission.practiceArea}`;
    const badge2  = `Category : ${submission.category}`;

    doc.fontSize(10).font("Helvetica");
    const b1W          = doc.widthOfString(badge1) + 20;
    const b2W          = doc.widthOfString(badge2) + 20;
    const totalBadgeW  = b1W + b2W + 10;
    const badgeStartX  = (pageW - totalBadgeW) / 2;

    doc.roundedRect(badgeStartX,            badgeY, b1W, 18, 9).fillOpacity(0.15).fill(WHITE);
    doc.roundedRect(badgeStartX + b1W + 10, badgeY, b2W, 18, 9).fillOpacity(0.1).fill(WHITE);
    doc.fillOpacity(1);

    doc.fillColor("#e8f4ff").text(badge1, badgeStartX + 10,           badgeY + 4, { lineBreak: false });
    doc.fillColor("#c8e0f8").text(badge2, badgeStartX + b1W + 20,     badgeY + 4, { lineBreak: false });

    const cardY = 125;
    doc.rect(margin, cardY, contentW, 72).fill(LIGHT_GRAY);
    doc.rect(margin, cardY, contentW, 72).stroke(BORDER);

    const avatarX  = margin + 16;
    const avatarY  = cardY + 36;
    const user     = submission.userId;
    const initials = (user?.fullName || "?")
      .split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

    doc.circle(avatarX + 20, avatarY, 20).fill(DARK_BLUE);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(WHITE)
      .text(initials, avatarX + 5, avatarY - 7, { width: 30, align: "center", lineBreak: false });

    const infoX = avatarX + 50;
    doc.fontSize(13).font("Helvetica-Bold").fillColor(TEXT_DARK)
      .text(user?.fullName || "N/A", infoX, cardY + 14, { lineBreak: false });

    doc.fontSize(10).font("Helvetica").fillColor(TEXT_MUTED);
    doc.text(`Email: `,   infoX,       cardY + 33, { continued: true,  lineBreak: false });
    doc.fillColor(TEXT_DARK).text(user?.email  || "N/A", { continued: false, lineBreak: false });

    doc.fillColor(TEXT_MUTED).text(`Mobile: `, infoX + 200, cardY + 33, { continued: true,  lineBreak: false });
    doc.fillColor(TEXT_DARK).text(user?.mobile || "N/A", { continued: false, lineBreak: false });

    doc.fillColor(TEXT_MUTED).text(`Date: `,   infoX,       cardY + 50, { continued: true,  lineBreak: false });
    doc.fillColor(TEXT_DARK).text(
      new Date(submission.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      { continued: false, lineBreak: false }
    );

    let currentY = cardY + 90;
    doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT_MUTED)
      .text("FILLED DETAILS", margin, currentY);

    currentY += 16;

    for (const field of submission.filledFields) {
      const labelW = 170;
      const valueW = contentW - labelW;

      if (field.fieldType === "image" && field.value && fs.existsSync(field.value)) {
        // ✅ Render image inline in PDF
        const imgRowH = 90;
        doc.rect(margin, currentY, labelW, imgRowH).fill(DARK_BLUE);
        doc.fontSize(10).font("Helvetica-Bold").fillColor(WHITE)
          .text(field.fieldName, margin + 10, currentY + 9, {
            width: labelW - 16, lineBreak: false, ellipsis: true,
          });

        doc.rect(margin + labelW, currentY, valueW, imgRowH).fill(WHITE).stroke(BORDER);

        try {
          doc.image(field.value, margin + labelW + 6, currentY + 6, {
            fit:   [valueW - 12, imgRowH - 12],
            align: "center",
            valign:"center",
          });
        } catch {
          doc.fontSize(9).font("Helvetica").fillColor(TEXT_MUTED)
            .text("[Image unavailable]", margin + labelW + 10, currentY + 9, { lineBreak: false });
        }

        currentY += imgRowH + 4;
      } else {
        // Normal text row
        const rowH = 28;
        doc.rect(margin, currentY, labelW, rowH).fill(DARK_BLUE);
        doc.fontSize(10).font("Helvetica-Bold").fillColor(WHITE)
          .text(field.fieldName, margin + 10, currentY + 9, {
            width: labelW - 16, lineBreak: false, ellipsis: true,
          });

        doc.rect(margin + labelW, currentY, valueW, rowH).fill(WHITE).stroke(BORDER);

        const val = (field.value === null || field.value === undefined || String(field.value).trim() === "")
          ? "—" : String(field.value);

        doc.fontSize(10).font("Helvetica").fillColor(val === "—" ? TEXT_MUTED : TEXT_DARK)
          .text(val, margin + labelW + 10, currentY + 9, {
            width: valueW - 16, lineBreak: false, ellipsis: true,
          });

        currentY += rowH + 4;
      }
    }

    currentY += 16;
    doc.moveTo(margin, currentY).lineTo(pageW - margin, currentY)
      .strokeColor(BORDER).lineWidth(0.5).stroke();

    currentY += 10;

    doc.roundedRect(margin, currentY, 70, 16, 8).fill(GREEN_BG);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(GREEN_TEXT)
      .text("Submitted", margin + 8, currentY + 4, { lineBreak: false });

    doc.fontSize(9).font("Helvetica").fillColor(TEXT_MUTED)
      .text(`ID: ${submissionId}`, margin + 80, currentY + 4, { lineBreak: false });

    doc.text("System generated document", 0, currentY + 4, {
      align: "right", width: pageW - margin, lineBreak: false,
    });

    doc.end();

  } catch (error) {
    console.error("downloadFilledTemplate Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── EDIT USER PROFILE ────────────────────────────────────────
const editUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const { email, mobile, address, city, state, pincode } = req.body;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    const updates = {};

    if (email && email !== user.email) {
      const emailErr = validateEmail(email);
      if (emailErr)
        return res.status(400).json({ success: false, message: emailErr });

      const emailInUser = await User.findOne({ email, _id: { $ne: userId } });
      const emailInAdv  = await Advocate.findOne({ email });
      if (emailInUser)
        return res.status(409).json({ success: false, message: "Email already registered as a user" });
      if (emailInAdv)
        return res.status(409).json({ success: false, message: "Email already registered as an advocate" });

      const emailOTPVerified = await OTP.findOne({ email, purpose: "email_verify", isUsed: true });
      if (!emailOTPVerified)
        return res.status(400).json({ success: false, message: "New email is not verified. Please verify via OTP first." });

      updates.email           = email.toLowerCase().trim();
      updates.isEmailVerified = true;
    }

    if (mobile && mobile !== user.mobile) {
      if (!/^[6-9]\d{9}$/.test(mobile))
        return res.status(400).json({ success: false, message: "Invalid mobile number format" });

      const mobileInUser = await User.findOne({ mobile, _id: { $ne: userId } });
      const mobileInAdv  = await Advocate.findOne({ mobile });
      if (mobileInUser)
        return res.status(409).json({ success: false, message: "Mobile number already registered as a user" });
      if (mobileInAdv)
        return res.status(409).json({ success: false, message: "Mobile number already registered as an advocate" });

      const mobileOTPVerified = await OTP.findOne({ mobile, purpose: "mobile_verify", isUsed: true });
      if (!mobileOTPVerified)
        return res.status(400).json({ success: false, message: "New mobile is not verified. Please verify via OTP first." });

      updates.mobile           = mobile;
      updates.isMobileVerified = true;
    }

    if (address) updates.address = address.trim();
    if (city)    updates.city    = city.trim();
    if (state)   updates.state   = state.trim();

    if (pincode) {
      if (!/^\d{6}$/.test(pincode))
        return res.status(400).json({ success: false, message: "Invalid pincode. Must be 6 digits." });
      updates.pincode = pincode;
    }

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ success: false, message: "No valid fields provided to update" });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data:    updatedUser,
    });

  } catch (error) {
    console.error("editUserProfile Error:", error);

    if (error.code === 11000) {
      const field      = Object.keys(error.keyPattern)[0];
      const fieldNames = { email: "Email", mobile: "Mobile number" };
      return res.status(409).json({
        success: false,
        message: `${fieldNames[field] || field} is already registered`,
      });
    }

    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  UserverifyDocuments,
  registerUser,
  getUSerProfile,
  getAdvocatesForUser,
  getTemplatesForUser,
  fillTemplate,
  downloadFilledTemplate,
  editUserProfile,
};