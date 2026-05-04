const crypto = require("crypto");
const mongoose = require("mongoose");
const Meeting = require("../models/Meeting");
const UserFilledTemplate = require("../models/UserFilledTemplate");
const Advocate = require("../models/Advocate");
const User = require("../models/User");
const { sendMeetingInviteEmail } = require("./sendOTP");

const getDayName = (date) => {
    const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];
    return days[date.getDay()];
};

const toTimeString = (date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
};

const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
};

const formatIST = (date) => {
    return new Date(date).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
};

const parseScheduledAt = (scheduledAt) => {
    if (!scheduledAt) return null;

    const str = scheduledAt.trim();

    const amPmRegex = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
    const amPmMatch = str.match(amPmRegex);

    if (amPmMatch) {
        let [, year, month, day, hours, minutes, period] = amPmMatch;
        hours = parseInt(hours);
        minutes = parseInt(minutes);

        if (period.toUpperCase() === "AM") {
            if (hours === 12) hours = 0;
        } else {
            if (hours !== 12) hours += 12;
        }

        const date = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            hours,
            minutes,
            0,
        );
        return date;
    }

    const isoDate = new Date(str);
    if (!isNaN(isoDate.getTime())) return isoDate;

    return null;
};

const scheduleMeeting = async (req, res) => {
    try {
        const { userFilledTemplateId } = req.params;
        const { meetingLink, scheduledAt } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userFilledTemplateId))
            return res.status(400).json({
                success: false,
                message: "Invalid userFilledTemplateId",
            });

        if (!meetingLink?.trim())
            return res.status(400).json({
                success: false,
                message: "meetingLink is required",
            });

        if (!scheduledAt)
            return res.status(400).json({
                success: false,
                message: `scheduledAt is required. Format: "2026-05-06 10:00 AM" or "2026-05-06 02:00 PM"`,
            });

        if (!req.advocate?._id)
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Advocate not found",
            });

        const meetingStart = parseScheduledAt(scheduledAt);

        if (!meetingStart)
            return res.status(400).json({
                success: false,
                message: `Invalid scheduledAt format. Use: "2026-05-06 10:00 AM" or "2026-05-06 02:00 PM"`,
            });

        if (meetingStart <= new Date())
            return res.status(400).json({
                success: false,
                message: "scheduledAt must be a future date and time",
            });

        const meetingEnd = new Date(meetingStart.getTime() + 60 * 60 * 1000);

        const advocate = await Advocate.findById(req.advocate._id).select(
            "fullName email availableDays availableHours approvalStatus isActive",
        );

        if (!advocate)
            return res
                .status(404)
                .json({ success: false, message: "Advocate not found" });

        if (advocate.approvalStatus !== "approved" || !advocate.isActive)
            return res
                .status(403)
                .json({
                    success: false,
                    message: "Advocate is not active or approved",
                });

        const requestedDay = getDayName(meetingStart);

        if (!advocate.availableDays || advocate.availableDays.length === 0)
            return res
                .status(400)
                .json({
                    success: false,
                    message: "Advocate has not set available days",
                });

        if (!advocate.availableDays.includes(requestedDay))
            return res.status(400).json({
                success: false,
                message: `Advocate is not available on ${requestedDay}. Available days: ${advocate.availableDays.join(", ")}`,
            });

        if (!advocate.availableHours?.from || !advocate.availableHours?.to)
            return res
                .status(400)
                .json({
                    success: false,
                    message: "Advocate has not set available hours",
                });

        const advocateFromMinutes = timeToMinutes(advocate.availableHours.from);
        const advocateToMinutes = timeToMinutes(advocate.availableHours.to);
        const meetingStartMinutes = timeToMinutes(toTimeString(meetingStart));
        const meetingEndMinutes = timeToMinutes(toTimeString(meetingEnd));

        if (
            meetingStartMinutes < advocateFromMinutes ||
            meetingEndMinutes > advocateToMinutes
        )
            return res.status(400).json({
                success: false,
                message: `Meeting must be within advocate's available hours: ${advocate.availableHours.from} - ${advocate.availableHours.to}`,
            });

        const conflictingMeeting = await Meeting.findOne({
            advocateId: req.advocate._id,
            status: "scheduled",
            scheduledAt: { $lt: meetingEnd },
            scheduledEndAt: { $gt: meetingStart },
        });

        if (conflictingMeeting)
            return res.status(409).json({
                success: false,
                message: `Advocate already has a meeting scheduled on ${formatIST(conflictingMeeting.scheduledAt)} to ${formatIST(conflictingMeeting.scheduledEndAt)}`,
            });

        const userFilledTemplate = await UserFilledTemplate.findOne({
            _id: userFilledTemplateId,
            advocateId: req.advocate._id,
            status: "accepted",
        });

        if (!userFilledTemplate)
            return res.status(404).json({
                success: false,
                message:
                    "Template not found, not accepted yet, or does not belong to you",
            });

        const existingMeeting = await Meeting.findOne({
            userFilledTemplateId: userFilledTemplate._id,
            status: "scheduled",
        });

        if (existingMeeting)
            return res.status(409).json({
                success: false,
                message: "A meeting is already scheduled for this template",
            });

        const user = await User.findById(userFilledTemplate.userId).select(
            "fullName email",
        );

        if (!user)
            return res
                .status(404)
                .json({ success: false, message: "User not found" });

        const uniqueCode = crypto.randomInt(100000, 999999).toString();

        const meeting = await Meeting.create({
            advocateId: req.advocate._id,
            userId: userFilledTemplate.userId,
            userFilledTemplateId: userFilledTemplate._id,
            meetingLink: meetingLink.trim(),
            uniqueCode,
            scheduledAt: meetingStart,
            scheduledEndAt: meetingEnd,
        });

        const partyEmails = [];

        for (const party of userFilledTemplate.parties) {
            if (party.email) {
                let recipientName = party.partyName;
                let recipientEmail = party.email;

                if (party.userId) {
                    try {
                        const partyUser = await User.findById(party.userId).select(
                            "fullName email",
                        );
                        if (partyUser) {
                            recipientName = partyUser.fullName;
                            recipientEmail = partyUser.email || party.email;
                        }
                    } catch (e) {
                        console.warn(
                            `⚠️ Could not fetch user for party: ${party.partyName}`,
                        );
                    }
                }

                partyEmails.push({
                    name: recipientName,
                    email: recipientEmail,
                    partyName: party.partyName,
                });
            }
        }

        const mainUserAlreadyIncluded = partyEmails.some(
            (p) => p.email.toLowerCase() === user.email.toLowerCase(),
        );
        if (!mainUserAlreadyIncluded) {
            partyEmails.push({
                name: user.fullName,
                email: user.email,
                partyName: "Main",
            });
        }

        console.log(
            `📧 Sending meeting emails to ${partyEmails.length} parties...`,
        );

        for (const recipient of partyEmails) {
            try {
                await sendMeetingInviteEmail({
                    toEmail: recipient.email,
                    toName: recipient.name,
                    advocateName: advocate.fullName,
                    templateTitle: userFilledTemplate.title,
                    meetingLink: meetingLink.trim(),
                    uniqueCode,
                    scheduledAt: meetingStart,
                    scheduledEndAt: meetingEnd,
                });
                console.log(
                    `✅ Email sent to: ${recipient.email} (${recipient.partyName})`,
                );
            } catch (emailErr) {
                console.warn(
                    `⚠️ Email failed for ${recipient.email}:`,
                    emailErr.message,
                );
            }
        }
        return res.status(201).json({
            success: true,
            message: "Meeting scheduled successfully!",
            data: {
                meetingId: meeting._id,
                meetingLink: meeting.meetingLink,
                uniqueCode: meeting.uniqueCode,
                scheduledAt: formatIST(meeting.scheduledAt),
                scheduledEndAt: formatIST(meeting.scheduledEndAt),
                scheduledDay: requestedDay,
                sentTo: partyEmails.map((p) => ({
                    name: p.name,
                    email: p.email,
                    partyName: p.partyName,
                })),
            },
        });
    } catch (error) {
        console.error("scheduleMeeting Error:", error.message);
        console.error(error.stack);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};

const getAdvocateWeeklySchedule = async (req, res) => {
    try {
        if (!req.advocate?._id)
            return res.status(401).json({ success: false, message: "Unauthorized" });

        const advocate = await Advocate.findById(req.advocate._id).select(
            "fullName availableDays availableHours",
        );

        if (!advocate)
            return res
                .status(404)
                .json({ success: false, message: "Advocate not found" });

        const today = new Date();

        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);

        // Current week Monday
        const dayOfWeek = today.getDay();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const meetings = await Meeting.find({
            advocateId: req.advocate._id,
            $or: [
                { status: { $in: ["completed", "cancelled"] } },
                { status: "scheduled", scheduledAt: { $gte: todayStart } },
            ],
        })
            .populate("userId", "fullName email")
            .populate("userFilledTemplateId", "title practiceArea category")
            .sort({ scheduledAt: 1 })
            .select("-__v");

        // ✅ Build range: only expand if meetings exist outside current week
        let rangeStart = new Date(weekStart);
        let rangeEnd = new Date(weekEnd);

        if (meetings.length > 0) {
            const earliest = new Date(meetings[0].scheduledAt);
            const latest = new Date(meetings[meetings.length - 1].scheduledAt);

            // Expand start: snap to Monday of earliest meeting's week
            if (earliest < rangeStart) {
                const d = earliest.getDay();
                rangeStart = new Date(earliest);
                rangeStart.setDate(earliest.getDate() - (d === 0 ? 6 : d - 1));
                rangeStart.setHours(0, 0, 0, 0);
            }

            // Expand end: snap to Sunday of latest meeting's week
            if (latest > rangeEnd) {
                const d = latest.getDay();
                rangeEnd = new Date(latest);
                // d=0 means Sunday (already end of week), else go to next Sunday
                rangeEnd.setDate(latest.getDate() + (d === 0 ? 0 : 7 - d));
                rangeEnd.setHours(23, 59, 59, 999);
            }
        }

        const dayNames = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ];

        // ✅ Only include days that: are in current week OR have meetings
        const weekDays = [];
        const totalDays =
            Math.round((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)) + 1;

        for (let i = 0; i < totalDays; i++) {
            const day = new Date(rangeStart);
            day.setDate(rangeStart.getDate() + i);

            const dayMeetings = meetings.filter((m) => {
                return new Date(m.scheduledAt).toDateString() === day.toDateString();
            });

            const isCurrentWeek = day >= weekStart && day <= weekEnd;

            // ✅ Skip days outside current week that have no meetings
            if (!isCurrentWeek && dayMeetings.length === 0) continue;

            const dayName = dayNames[day.getDay()];
            const dateStr = day.toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "long",
                day: "numeric",
            });

            weekDays.push({
                date: dateStr,
                dayName,
                isToday: day.toDateString() === today.toDateString(), // ✅ uses unmutated today
                isAvailable: advocate.availableDays.includes(dayName),
                totalMeetings: dayMeetings.length,
                meetings: dayMeetings.map((m) => ({
                    meetingId: m._id,
                    status: m.status,
                    scheduledAt: formatIST(m.scheduledAt),
                    scheduledEndAt: formatIST(m.scheduledEndAt),
                    meetingLink: m.meetingLink,
                    uniqueCode: m.uniqueCode,
                    user: m.userId
                        ? { name: m.userId.fullName, email: m.userId.email }
                        : null,
                    template: m.userFilledTemplateId
                        ? {
                            title: m.userFilledTemplateId.title,
                            practiceArea: m.userFilledTemplateId.practiceArea,
                            category: m.userFilledTemplateId.category,
                        }
                        : null,
                })),
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                advocate: {
                    name: advocate.fullName,
                    availableDays: advocate.availableDays,
                    availableHours: advocate.availableHours,
                },
                weekRange: {
                    from: rangeStart.toLocaleDateString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    }),
                    to: rangeEnd.toLocaleDateString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    }),
                },
                summary: {
                    totalMeetings: meetings.length,
                    scheduledCount: meetings.filter((m) => m.status === "scheduled")
                        .length,
                    completedCount: meetings.filter((m) => m.status === "completed")
                        .length,
                    cancelledCount: meetings.filter((m) => m.status === "cancelled")
                        .length,
                },
                weekSchedule: weekDays,
            },
        });
    } catch (error) {
        console.error("getAdvocateWeeklySchedule Error:", error.message);
        console.error(error.stack);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};

const getUserMeetingsDashboard = async (req, res) => {
    try {
        if (!req.user?._id)
            return res.status(401).json({ success: false, message: "Unauthorized" });

        const userId = req.user._id;
        const userObjectId = new mongoose.Types.ObjectId(userId);

        const currentUser = await User.findById(userId).select("email fullName mobile");
        if (!currentUser)
            return res.status(404).json({ success: false, message: "User not found" });

        const userEmail = currentUser.email?.toLowerCase();

        const today = new Date();
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);

        console.log(`\n📌 [getUserMeetingsDashboard] START`);
        console.log(`   userId  : ${userId}`);
        console.log(`   email   : ${userEmail}`);
        console.log(`   name    : ${currentUser.fullName}`);

        // ── Step 1: Meetings where user is main holder ───────────────
        const mainHolderMeetings = await Meeting.find({ userId: userObjectId })
            .populate("advocateId", "fullName email mobile profilePicAdvocate practiceAreas city state")
            .populate("userFilledTemplateId", "title practiceArea category parties")
            .sort({ scheduledAt: -1 })
            .select("-__v");

        console.log(`\n✅ [Step 1] Main holder meetings: ${mainHolderMeetings.length}`);
        mainHolderMeetings.forEach((m, i) => {
            console.log(`   [${i + 1}] ${m._id} | ${m.status} | ${m.scheduledAt}`);
        });

        // ── Step 2: Templates where user is a party ──────────────────
        // userId match + email fallback (invited but not yet registered)
        const partyTemplates = await UserFilledTemplate.find({
            $or: [
                { "parties.userId": userObjectId },
                { "parties.email": userEmail },
            ],
            userId: { $ne: userObjectId }, // main holder wale already Step 1 mein hain
        }).select("_id title");

        const partyTemplateIds = partyTemplates.map((t) => t._id);

        console.log(`\n✅ [Step 2] Templates where user is a party: ${partyTemplates.length}`);
        partyTemplates.forEach((t, i) => {
            console.log(`   [${i + 1}] templateId: ${t._id} | title: ${t.title}`);
        });

        // ── Step 3: Meetings linked to those party templates ─────────
        const mainHolderMeetingIds = mainHolderMeetings.map((m) => m._id.toString());

        const partyMeetings = partyTemplateIds.length > 0
            ? await Meeting.find({
                userFilledTemplateId: { $in: partyTemplateIds },
                _id: { $nin: mainHolderMeetingIds }, // duplicates avoid karo
            })
                .populate("advocateId", "fullName email mobile profilePicAdvocate practiceAreas city state")
                .populate("userFilledTemplateId", "title practiceArea category parties")
                .sort({ scheduledAt: -1 })
                .select("-__v")
            : [];

        console.log(`\n✅ [Step 3] Party meetings: ${partyMeetings.length}`);
        partyMeetings.forEach((m, i) => {
            console.log(`   [${i + 1}] ${m._id} | ${m.status} | ${m.scheduledAt}`);
        });

        // ── Step 4: Merge ─────────────────────────────────────────────
        const allMeetings = [...mainHolderMeetings, ...partyMeetings];

        console.log(`\n✅ [Step 4] Total merged meetings: ${allMeetings.length}`);

        if (allMeetings.length === 0) {
            console.log(`⚠️  No meetings found. Debug info:`);
            console.log(`   - userId "${userObjectId}" not main holder of any meeting`);
            console.log(`   - email "${userEmail}" not found in any parties[].email`);
            console.log(`   - userId not found in any parties[].userId`);

            // Extra DB check for debugging
            const sampleTemplate = await UserFilledTemplate.findOne({}).select("title userId parties").lean();
            if (sampleTemplate) {
                console.log(`   Sample template title  : ${sampleTemplate.title}`);
                console.log(`   Sample template userId : ${sampleTemplate.userId}`);
                console.log(`   Sample parties:`);
                sampleTemplate.parties?.forEach((p, i) => {
                    console.log(`     [${i + 1}] partyName: ${p.partyName} | email: ${p.email} | userId: ${p.userId} | role: ${p.role}`);
                });
            } else {
                console.log(`   ⚠️  No templates found in DB at all!`);
            }
        }

        // ── Categorize ────────────────────────────────────────────────
        const upcomingMeetings  = allMeetings.filter(
            (m) => m.status === "scheduled" && new Date(m.scheduledAt) >= todayStart
        );
        const completedMeetings = allMeetings.filter((m) => m.status === "completed");
        const cancelledMeetings = allMeetings.filter((m) => m.status === "cancelled");
        const missedMeetings    = allMeetings.filter(
            (m) => m.status === "scheduled" && new Date(m.scheduledAt) < todayStart
        );

        const nextMeeting = [...upcomingMeetings]
            .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0] || null;

        console.log(`\n📊 Summary:`);
        console.log(`   Upcoming  : ${upcomingMeetings.length}`);
        console.log(`   Completed : ${completedMeetings.length}`);
        console.log(`   Cancelled : ${cancelledMeetings.length}`);
        console.log(`   Missed    : ${missedMeetings.length}`);
        console.log(`   Next      : ${nextMeeting ? nextMeeting._id : "None"}`);

        allMeetings.forEach((m, i) => {
            const isMain = m.userId?.toString() === userId.toString();
            console.log(`\n   [Meeting ${i + 1}]`);
            console.log(`     id         : ${m._id}`);
            console.log(`     status     : ${m.status}`);
            console.log(`     role       : ${isMain ? "MAIN HOLDER" : "PARTY"}`);
            console.log(`     scheduledAt: ${m.scheduledAt}`);
            console.log(`     advocate   : ${m.advocateId?.fullName || "NOT POPULATED"}`);
            console.log(`     template   : ${m.userFilledTemplateId?.title || "NOT POPULATED"}`);
        });

        // ── Format helper ─────────────────────────────────────────────
        const formatMeeting = (m) => ({
            meetingId: m._id,
            status: m.status,
            isMainHolder: m.userId?.toString() === userId.toString(),
            scheduledAt: formatIST(m.scheduledAt),
            scheduledEndAt: formatIST(m.scheduledEndAt),
            meetingLink: m.meetingLink,
            uniqueCode: m.uniqueCode,
            advocate: m.advocateId
                ? {
                    id: m.advocateId._id,
                    name: m.advocateId.fullName,
                    email: m.advocateId.email,
                    mobile: m.advocateId.mobile || null,           // ✅ Advocate model: mobile
                    profilePic: m.advocateId.profilePicAdvocate || null, // ✅ Advocate model: profilePicAdvocate
                    practiceAreas: m.advocateId.practiceAreas || [],
                    city: m.advocateId.city || null,
                    state: m.advocateId.state || null,
                }
                : null,
            template: m.userFilledTemplateId
                ? {
                    title: m.userFilledTemplateId.title,
                    practiceArea: m.userFilledTemplateId.practiceArea,
                    category: m.userFilledTemplateId.category,
                }
                : null,
        });

        console.log(`\n✅ [getUserMeetingsDashboard] Response sent successfully\n`);

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalMeetings:  allMeetings.length,
                    upcomingCount:  upcomingMeetings.length,
                    completedCount: completedMeetings.length,
                    cancelledCount: cancelledMeetings.length,
                    missedCount:    missedMeetings.length,
                },
                nextMeeting: nextMeeting ? formatMeeting(nextMeeting) : null,
                upcomingMeetings: [...upcomingMeetings]
                    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                    .map(formatMeeting),
                completedMeetings: completedMeetings.map(formatMeeting),
                cancelledMeetings: cancelledMeetings.map(formatMeeting),
                missedMeetings:    missedMeetings.map(formatMeeting),
            },
        });

    } catch (error) {
        console.error("getUserMeetingsDashboard Error:", error.message);
        console.error(error.stack);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
module.exports = { scheduleMeeting, getAdvocateWeeklySchedule, getUserMeetingsDashboard };
