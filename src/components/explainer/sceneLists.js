import * as Employee from './EmployeeScenes'
import * as Head from './HeadScenes'
import * as Student from './StudentScenes'

export const STUDENT_SCENES = [
    { key: "intro", View: Student.SceneIntro, chapter: "Intro", title: "Registrar documents, tracked online", text: "CertiChain is HCDC’s online registrar service. Once you're assessed, paid and verified at the Registrar's Office, track your documents from one account — no more trips just to check your status.", ms: 6000 },
    { key: "account", View: Student.SceneAccount, chapter: "Account", title: "Create your account", text: "Register with your student details. The Registrar verifies your record, so only real students can request.", ms: 5500 },
    { key: "request", View: Student.SceneRequest, chapter: "Step 1", title: "Request a document", text: "Already assessed, paid and verified in person? Choose the document online, type the copies and purpose, then submit. Your request number appears right away.", ms: 7000 },
    { key: "requirements", View: Student.SceneRequirements, chapter: "Step 2", title: "Upload your requirements", text: "Upload a clear photo or PDF of each requirement. If one is rejected, you see the reason and upload it again.", ms: 6500 },
    { key: "payment", View: Student.ScenePayment, chapter: "Step 3", title: "Upload your verified receipt", text: "Upload a photo of the Official Receipt you already paid and had verified in person. The Registrar checks it online.", ms: 6500 },
    { key: "review", View: Student.SceneReview, chapter: "Step 4", title: "Registrar review", text: "The Registrar checks your receipt and requirements. If something is missing, you see the reason. Once everything is complete, your payment is verified.", ms: 6500 },
    { key: "processing", View: Student.SceneProcessing, chapter: "Step 5", title: "Your document is prepared", text: "The Registrar prepares your document. You can follow each step on your request, with a notification at every change.", ms: 6000 },
    { key: "schedule", View: Student.SceneSchedule, chapter: "Step 6", title: "Ready for pickup", text: "When it is ready you get a date, time and window. Bring a valid ID and your Official Receipt, or send a representative.", ms: 6000 },
    { key: "claim", View: Student.SceneComplete, chapter: "Step 7", title: "Claim it, and you're done", text: "Claim your document at the Registrar’s Office. Your request is marked completed and stays in your request history.", ms: 6000 },
    { key: "cta", View: Student.SceneCta, chapter: "Start", title: "Request, track and claim, all online", text: "Create a free account and request your first document today.", ms: 5000 },
]

export const EMPLOYEE_SCENES = [
    { key: 'assigned', View: Employee.SceneEmpIntro, chapter: 'Intro', title: 'Your assigned requests', text: 'Requests from your colleges and programs are routed to you automatically, newest first, with their status.', ms: 5500 },
    { key: 'verify', View: Employee.SceneEmpVerify, chapter: 'Step 1', title: 'Verify the payment', text: 'Check the uploaded official receipt against the request — number, amount and that it hasn’t been used before.', ms: 6500 },
    { key: 'process', View: Employee.SceneEmpProcess, chapter: 'Step 2', title: 'Process and schedule', text: 'Move the request through processing, then set the claiming date and time. The student is notified instantly.', ms: 6000 },
    { key: 'release', View: Employee.SceneEmpRelease, chapter: 'Step 3', title: 'Release on claim day', text: 'Call the walk-in number, check the ID and receipt, and mark it claimed — the signed credential is issued.', ms: 6000 },
    { key: 'chat', View: Employee.SceneEmpChat, chapter: 'Messages', title: 'Answer students quickly', text: 'Status inquiries get an automatic reply that quotes the question, and you can reply or follow up anytime.', ms: 6000 },
    { key: 'cta', View: Employee.SceneStaffCta, chapter: 'Try it', title: 'Now try it on the real pages', text: 'Start the guided demo to walk through each page of your portal.', ms: 5000 },
]

export const HEAD_SCENES = [
    { key: 'dashboard', View: Head.SceneHeadDash, chapter: 'Overview', title: 'The whole office at a glance', text: 'Live totals for every status and the week’s requests, updating as your staff work.', ms: 5500 },
    { key: 'assign', View: Head.SceneHeadAssign, chapter: 'Step 1', title: 'Assign requests to staff', text: 'Requests are routed to employees by college and program; assign or reassign any request in one click.', ms: 6000 },
    { key: 'publish', View: Head.SceneHeadPublish, chapter: 'Step 2', title: 'Announce to students', text: 'Publish announcements with office hours — they appear on every student’s dashboard right away.', ms: 6000 },
    { key: 'calendar', View: Head.SceneHeadCalendar, chapter: 'Step 3', title: 'Open extra office days', text: 'Mondays and weekends are closed by default. Open one with hours, and claims can be scheduled there.', ms: 5500 },
    { key: 'oversee', View: Head.SceneHeadOversee, chapter: 'Step 4', title: 'Oversee and report', text: 'Every action is logged with who and when, and reports export requests and revenue.', ms: 6000 },
    { key: 'cta', View: Employee.SceneStaffCta, chapter: 'Try it', title: 'Now try it on the real pages', text: 'Start the guided demo to walk through each page of the Registrar Head portal.', ms: 5000 },
]
