// MeetingNotesAI iOS App
// SwiftUI app for recording and summarizing meetings

import SwiftUI
import AVFoundation
import Combine

struct ContentView: View {
    @StateObject private var viewModel = RecordingViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("MeetingBrief Local Recorder")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .textCase(.uppercase)
                            .foregroundStyle(.secondary)

                        Text("Record on device, upload straight to the backend.")
                            .font(.largeTitle)
                            .fontWeight(.bold)

                        Text("Configured for local backend testing without authentication.")
                            .foregroundStyle(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        Text("Backend URL")
                            .font(.headline)
                        TextField("http://localhost:8000", text: $viewModel.backendURL)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                            .textFieldStyle(.roundedBorder)

                        Text("Meeting title")
                            .font(.headline)
                        TextField("Weekly standup", text: $viewModel.meetingTitle)
                            .textFieldStyle(.roundedBorder)
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Label(viewModel.isRecording ? "recording" : viewModel.isUploading ? "uploading" : viewModel.recordingURL != nil ? "stopped" : "idle", systemImage: "waveform.circle.fill")
                                .font(.headline)
                            Spacer()
                            Text(viewModel.elapsedLabel)
                                .font(.title2.monospacedDigit())
                        }

                        Text(viewModel.statusMessage)
                            .foregroundStyle(.secondary)

                        if !viewModel.errorMessage.isEmpty {
                            Text(viewModel.errorMessage)
                                .foregroundStyle(.red)
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.red.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        HStack(spacing: 12) {
                            Button("Start Recording") {
                                viewModel.startRecording()
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(viewModel.isRecording || viewModel.isUploading)

                            Button("Stop") {
                                viewModel.stopRecording()
                            }
                            .buttonStyle(.bordered)
                            .disabled(!viewModel.isRecording)

                            Button("Reset") {
                                viewModel.reset()
                            }
                            .buttonStyle(.bordered)
                            .disabled(viewModel.isUploading)
                        }

                        Button("Upload Recording") {
                            Task {
                                await viewModel.uploadRecording()
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(viewModel.recordingURL == nil || viewModel.isRecording || viewModel.isUploading)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Last upload")
                            .font(.title3)
                            .fontWeight(.semibold)

                        if let result = viewModel.uploadResult {
                            LabeledContent("Meeting ID", value: result.id)
                            LabeledContent("Status", value: result.status)
                            LabeledContent("Duration", value: "\(result.durationSeconds)s")
                            LabeledContent("Audio URL", value: result.audioURL ?? "n/a")
                        } else {
                            Text("No upload completed yet.")
                                .foregroundStyle(.secondary)
                        }
                    }

                    VStack(alignment: .leading, spacing: 16) {
                        Text("Meeting artifacts")
                            .font(.title3)
                            .fontWeight(.semibold)

                        if viewModel.uploadResult == nil {
                            Text("Upload a meeting first to manage transcript, summary, and action items.")
                                .foregroundStyle(.secondary)
                        } else {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Transcript")
                                    .font(.headline)
                                TextField("Provider", text: $viewModel.transcriptProvider)
                                    .textFieldStyle(.roundedBorder)
                                TextEditor(text: $viewModel.transcriptText)
                                    .frame(minHeight: 140)
                                    .padding(8)
                                    .background(Color(uiColor: .secondarySystemBackground))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                Button("Save Transcript") {
                                    Task {
                                        await viewModel.saveTranscript()
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(viewModel.isSavingArtifacts || viewModel.transcriptText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                            }

                            VStack(alignment: .leading, spacing: 12) {
                                Text("Summary")
                                    .font(.headline)
                                TextField("Provider", text: $viewModel.summaryProvider)
                                    .textFieldStyle(.roundedBorder)
                                TextEditor(text: $viewModel.summaryText)
                                    .frame(minHeight: 140)
                                    .padding(8)
                                    .background(Color(uiColor: .secondarySystemBackground))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                Button("Save Summary") {
                                    Task {
                                        await viewModel.saveSummary()
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(viewModel.isSavingArtifacts || viewModel.summaryText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                            }

                            VStack(alignment: .leading, spacing: 12) {
                                Text("Action items")
                                    .font(.headline)
                                TextField("Description", text: $viewModel.newActionItemDescription)
                                    .textFieldStyle(.roundedBorder)
                                TextField("Owner", text: $viewModel.newActionItemOwner)
                                    .textFieldStyle(.roundedBorder)
                                TextField("Due date (optional ISO string)", text: $viewModel.newActionItemDueAt)
                                    .textFieldStyle(.roundedBorder)
                                Button("Add Action Item") {
                                    Task {
                                        await viewModel.addActionItem()
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(viewModel.isSavingArtifacts || viewModel.newActionItemDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                                if viewModel.actionItems.isEmpty {
                                    Text("No action items yet.")
                                        .foregroundStyle(.secondary)
                                } else {
                                    ForEach(viewModel.actionItems) { item in
                                        VStack(alignment: .leading, spacing: 8) {
                                            Text(item.description)
                                                .fontWeight(.semibold)
                                                .strikethrough(item.completed)
                                            Text(item.ownerName ?? "Unassigned")
                                                .foregroundStyle(.secondary)
                                            HStack {
                                                Button(item.completed ? "Mark Open" : "Complete") {
                                                    Task {
                                                        await viewModel.toggleActionItem(item)
                                                    }
                                                }
                                                .buttonStyle(.bordered)

                                                Button("Delete", role: .destructive) {
                                                    Task {
                                                        await viewModel.deleteActionItem(item)
                                                    }
                                                }
                                                .buttonStyle(.bordered)
                                            }
                                        }
                                        .padding(12)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .background(Color(uiColor: .secondarySystemBackground))
                                        .clipShape(RoundedRectangle(cornerRadius: 12))
                                    }
                                }
                            }

                            if !viewModel.artifactsMessage.isEmpty {
                                Text(viewModel.artifactsMessage)
                                    .foregroundStyle(.secondary)
                            }

                            if !viewModel.artifactsError.isEmpty {
                                Text(viewModel.artifactsError)
                                    .foregroundStyle(.red)
                                    .padding(12)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color.red.opacity(0.1))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }
                    }
                }
                .padding(20)
            }
            .navigationTitle("Meeting Notes AI")
        }
        .task {
            viewModel.prepareAudioSession()
        }
    }
}

struct MeetingUploadResponse: Decodable {
    let id: String
    let userID: String
    let status: String
    let audioURL: String?
    let durationSeconds: Int
    let title: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case status
        case audioURL = "audio_url"
        case durationSeconds = "duration_seconds"
        case title
        case createdAt = "created_at"
    }
}

struct MeetingTranscriptResponse: Decodable {
    let id: Int
    let meetingID: String
    let transcriptText: String
    let provider: String?

    enum CodingKeys: String, CodingKey {
        case id
        case meetingID = "meeting_id"
        case transcriptText = "transcript_text"
        case provider
    }
}

struct MeetingSummaryResponse: Decodable {
    let id: Int
    let meetingID: String
    let summaryText: String
    let provider: String?

    enum CodingKeys: String, CodingKey {
        case id
        case meetingID = "meeting_id"
        case summaryText = "summary_text"
        case provider
    }
}

struct ActionItemResponse: Decodable, Identifiable {
    let id: Int
    let meetingID: String
    let description: String
    let ownerName: String?
    let dueAt: String?
    let completed: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case meetingID = "meeting_id"
        case description
        case ownerName = "owner_name"
        case dueAt = "due_at"
        case completed
    }
}

private struct MeetingStartRequest: Encodable {
    let title: String?
}

private struct MeetingTranscriptRequest: Encodable {
    let transcriptText: String
    let provider: String?

    enum CodingKeys: String, CodingKey {
        case transcriptText = "transcript_text"
        case provider
    }
}

private struct MeetingSummaryRequest: Encodable {
    let summaryText: String
    let provider: String?

    enum CodingKeys: String, CodingKey {
        case summaryText = "summary_text"
        case provider
    }
}

private struct ActionItemCreateRequest: Encodable {
    let description: String
    let ownerName: String?
    let dueAt: String?
    let completed: Bool

    enum CodingKeys: String, CodingKey {
        case description
        case ownerName = "owner_name"
        case dueAt = "due_at"
        case completed
    }
}

private struct ActionItemUpdateRequest: Encodable {
    let completed: Bool
}

@MainActor
final class RecordingViewModel: NSObject, ObservableObject {
    @Published var backendURL = "http://localhost:8000"
    @Published var meetingTitle = ""
    @Published var statusMessage = "Ready to record."
    @Published var errorMessage = ""
    @Published var isRecording = false
    @Published var isUploading = false
    @Published var elapsedSeconds = 0
    @Published var recordingURL: URL?
    @Published var uploadResult: MeetingUploadResponse?
    @Published var transcriptText = ""
    @Published var transcriptProvider = ""
    @Published var summaryText = ""
    @Published var summaryProvider = ""
    @Published var actionItems: [ActionItemResponse] = []
    @Published var newActionItemDescription = ""
    @Published var newActionItemOwner = ""
    @Published var newActionItemDueAt = ""
    @Published var artifactsMessage = ""
    @Published var artifactsError = ""
    @Published var isSavingArtifacts = false

    private var audioRecorder: AVAudioRecorder?
    private var timer: Timer?
    private var recordingStartedAt: Date?

    var elapsedLabel: String {
        String(format: "%02d:%02d", elapsedSeconds / 60, elapsedSeconds % 60)
    }

    func prepareAudioSession() {
        let handlePermission: @Sendable (Bool) -> Void = { _ in
        }

        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission(completionHandler: handlePermission)
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission(handlePermission)
        }
    }

    func startRecording() {
        errorMessage = ""
        uploadResult = nil

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try session.setActive(true)

            let outputURL = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension("m4a")

            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44_100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            ]

            let recorder = try AVAudioRecorder(url: outputURL, settings: settings)
            recorder.record()

            audioRecorder = recorder
            recordingURL = outputURL
            recordingStartedAt = Date()
            elapsedSeconds = 0
            isRecording = true
            statusMessage = "Recording in progress."
            startTimer()
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = "Unable to start recording."
            isRecording = false
        }
    }

    func stopRecording() {
        audioRecorder?.stop()
        isRecording = false
        stopTimer()
        statusMessage = recordingURL == nil ? "Recording stopped." : "Recording captured and ready to upload."
    }

    func reset() {
        stopRecording()
        recordingURL = nil
        uploadResult = nil
        elapsedSeconds = 0
        errorMessage = ""
        transcriptText = ""
        transcriptProvider = ""
        summaryText = ""
        summaryProvider = ""
        actionItems = []
        newActionItemDescription = ""
        newActionItemOwner = ""
        newActionItemDueAt = ""
        artifactsMessage = ""
        artifactsError = ""
        statusMessage = "Ready to record."
    }

    func uploadRecording() async {
        guard let recordingURL else {
            errorMessage = "Record audio before uploading."
            return
        }

        errorMessage = ""
        isUploading = true
        statusMessage = "Uploading recording..."

        do {
            statusMessage = "Creating meeting..."
            let startedMeeting = try await startMeeting()

            statusMessage = "Uploading recording..."
            _ = try await uploadAudio(for: startedMeeting.id, fileURL: recordingURL)

            statusMessage = "Finalizing meeting..."
            uploadResult = try await finalizeMeeting(id: startedMeeting.id)
            try await refreshArtifacts(meetingID: startedMeeting.id)
            statusMessage = "Upload complete. Meeting created and finalized successfully."
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = "Upload failed."
        }

        isUploading = false
    }

    func saveTranscript() async {
        guard let meetingID = uploadResult?.id else {
            return
        }

        await saveArtifactsOperation {
            let baseURL = try baseEndpoint()
            let url = baseURL.appendingPathComponent("meetings").appendingPathComponent(meetingID).appendingPathComponent("transcript")
            var request = request(url: url, method: "PUT")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let payload = MeetingTranscriptRequest(
                transcriptText: transcriptText,
                provider: transcriptProvider.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : transcriptProvider.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            let body = try JSONEncoder().encode(payload)
            let (data, response) = try await URLSession.shared.upload(for: request, from: body)
            try validateResponse(data: data, response: response, defaultMessage: "Failed to save transcript.")
            try await refreshArtifacts(meetingID: meetingID)
            artifactsMessage = "Transcript saved."
        }
    }

    func saveSummary() async {
        guard let meetingID = uploadResult?.id else {
            return
        }

        await saveArtifactsOperation {
            let baseURL = try baseEndpoint()
            let url = baseURL.appendingPathComponent("meetings").appendingPathComponent(meetingID).appendingPathComponent("summary")
            var request = request(url: url, method: "PUT")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let payload = MeetingSummaryRequest(
                summaryText: summaryText,
                provider: summaryProvider.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : summaryProvider.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            let body = try JSONEncoder().encode(payload)
            let (data, response) = try await URLSession.shared.upload(for: request, from: body)
            try validateResponse(data: data, response: response, defaultMessage: "Failed to save summary.")
            try await refreshArtifacts(meetingID: meetingID)
            artifactsMessage = "Summary saved."
        }
    }

    func addActionItem() async {
        guard let meetingID = uploadResult?.id else {
            return
        }

        await saveArtifactsOperation {
            let baseURL = try baseEndpoint()
            let url = baseURL.appendingPathComponent("meetings").appendingPathComponent(meetingID).appendingPathComponent("action-items")
            var request = request(url: url, method: "POST")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let payload = ActionItemCreateRequest(
                description: newActionItemDescription.trimmingCharacters(in: .whitespacesAndNewlines),
                ownerName: newActionItemOwner.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : newActionItemOwner.trimmingCharacters(in: .whitespacesAndNewlines),
                dueAt: newActionItemDueAt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : newActionItemDueAt.trimmingCharacters(in: .whitespacesAndNewlines),
                completed: false
            )
            let body = try JSONEncoder().encode(payload)
            let (data, response) = try await URLSession.shared.upload(for: request, from: body)
            try validateResponse(data: data, response: response, defaultMessage: "Failed to add action item.")
            newActionItemDescription = ""
            newActionItemOwner = ""
            newActionItemDueAt = ""
            try await refreshArtifacts(meetingID: meetingID)
            artifactsMessage = "Action item added."
        }
    }

    func toggleActionItem(_ item: ActionItemResponse) async {
        await updateActionItem(item, completed: !item.completed, successMessage: "Action item updated.")
    }

    func deleteActionItem(_ item: ActionItemResponse) async {
        guard let meetingID = uploadResult?.id else {
            return
        }

        await saveArtifactsOperation {
            let baseURL = try baseEndpoint()
            let url = baseURL.appendingPathComponent("meetings").appendingPathComponent(meetingID).appendingPathComponent("action-items").appendingPathComponent(String(item.id))
            let request = request(url: url, method: "DELETE")
            let (data, response) = try await URLSession.shared.data(for: request)
            try validateResponse(data: data, response: response, defaultMessage: "Failed to delete action item.")
            try await refreshArtifacts(meetingID: meetingID)
            artifactsMessage = "Action item deleted."
        }
    }

    private func startTimer() {
        stopTimer()
        timer = Timer.scheduledTimer(timeInterval: 0.25, target: self, selector: #selector(handleTimerTick), userInfo: nil, repeats: true)
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    @objc private func handleTimerTick() {
        guard let recordingStartedAt else {
            return
        }

        elapsedSeconds = max(1, Int(Date().timeIntervalSince(recordingStartedAt).rounded()))
    }

    private func baseEndpoint() throws -> URL {
        let normalized = backendURL.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        guard let url = URL(string: normalized) else {
            throw UploadError.invalidBackendURL
        }

        return url
    }

    private func request(url: URL, method: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        return request
    }

    private func refreshArtifacts(meetingID: String) async throws {
        let baseURL = try baseEndpoint()

        let transcriptURL = baseURL.appendingPathComponent("meetings").appendingPathComponent(meetingID).appendingPathComponent("transcript")
        let summaryURL = baseURL.appendingPathComponent("meetings").appendingPathComponent(meetingID).appendingPathComponent("summary")
        let actionItemsURL = baseURL.appendingPathComponent("meetings").appendingPathComponent(meetingID).appendingPathComponent("action-items")

        let transcript = try await fetchOptional(MeetingTranscriptResponse.self, url: transcriptURL)
        let summary = try await fetchOptional(MeetingSummaryResponse.self, url: summaryURL)

        let actionItemsRequest = request(url: actionItemsURL, method: "GET")
        let (actionItemsData, actionItemsResponse) = try await URLSession.shared.data(for: actionItemsRequest)
        try validateResponse(data: actionItemsData, response: actionItemsResponse, defaultMessage: "Failed to load action items.")
        actionItems = try JSONDecoder().decode([ActionItemResponse].self, from: actionItemsData)

        transcriptText = transcript?.transcriptText ?? ""
        transcriptProvider = transcript?.provider ?? ""
        summaryText = summary?.summaryText ?? ""
        summaryProvider = summary?.provider ?? ""
        artifactsError = ""
        artifactsMessage = (transcript != nil || summary != nil || !actionItems.isEmpty)
            ? "Meeting artifacts synced from the backend."
            : "No transcript, summary, or action items saved yet."
    }

    private func fetchOptional<T: Decodable>(_ type: T.Type, url: URL) async throws -> T? {
        let request = request(url: url, method: "GET")
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw UploadError.invalidResponse
        }

        if httpResponse.statusCode == 404 {
            return nil
        }

        try validateResponse(data: data, response: response, defaultMessage: "Failed to load meeting artifacts.")
        return try JSONDecoder().decode(type, from: data)
    }

    private func updateActionItem(_ item: ActionItemResponse, completed: Bool, successMessage: String) async {
        guard let meetingID = uploadResult?.id else {
            return
        }

        await saveArtifactsOperation {
            let baseURL = try baseEndpoint()
            let url = baseURL.appendingPathComponent("meetings").appendingPathComponent(meetingID).appendingPathComponent("action-items").appendingPathComponent(String(item.id))
            var request = request(url: url, method: "PATCH")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let body = try JSONEncoder().encode(ActionItemUpdateRequest(completed: completed))
            let (data, response) = try await URLSession.shared.upload(for: request, from: body)
            try validateResponse(data: data, response: response, defaultMessage: "Failed to update action item.")
            try await refreshArtifacts(meetingID: meetingID)
            artifactsMessage = successMessage
        }
    }

    private func saveArtifactsOperation(_ operation: @escaping () async throws -> Void) async {
        artifactsError = ""
        isSavingArtifacts = true

        do {
            try await operation()
        } catch {
            artifactsError = error.localizedDescription
        }

        isSavingArtifacts = false
    }

    private func startMeeting() async throws -> MeetingUploadResponse {
        let baseURL = try baseEndpoint()
        let startURL = baseURL.appendingPathComponent("meetings/start")
        var request = request(url: startURL, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let trimmedTitle = meetingTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let payload = MeetingStartRequest(title: trimmedTitle.isEmpty ? nil : trimmedTitle)
        let body = try JSONEncoder().encode(payload)

        let (data, response) = try await URLSession.shared.upload(for: request, from: body)
        try validateResponse(data: data, response: response, defaultMessage: "Failed to create meeting.")
        return try JSONDecoder().decode(MeetingUploadResponse.self, from: data)
    }

    private func uploadAudio(for meetingID: String, fileURL: URL) async throws -> MeetingUploadResponse {
        let baseURL = try baseEndpoint()
        let uploadURL = baseURL
            .appendingPathComponent("meetings")
            .appendingPathComponent(meetingID)
            .appendingPathComponent("upload-audio")

        var request = request(url: uploadURL, method: "POST")
        let boundary = "Boundary-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        let body = try multipartBody(for: fileURL, boundary: boundary)
        let (data, response) = try await URLSession.shared.upload(for: request, from: body)
        try validateResponse(data: data, response: response, defaultMessage: "Failed to upload recording.")
        return try JSONDecoder().decode(MeetingUploadResponse.self, from: data)
    }

    private func finalizeMeeting(id meetingID: String) async throws -> MeetingUploadResponse {
        let baseURL = try baseEndpoint()
        let finalizeURL = baseURL
            .appendingPathComponent("meetings")
            .appendingPathComponent(meetingID)
            .appendingPathComponent("finalize")

        let request = request(url: finalizeURL, method: "POST")
        let (data, response) = try await URLSession.shared.data(for: request)
        try validateResponse(data: data, response: response, defaultMessage: "Failed to finalize meeting.")
        return try JSONDecoder().decode(MeetingUploadResponse.self, from: data)
    }

    private func multipartBody(for fileURL: URL, boundary: String) throws -> Data {
        var body = Data()
        let lineBreak = "\r\n"
        let fileData = try Data(contentsOf: fileURL)
        let duration = max(elapsedSeconds, 1)

        func appendField(name: String, value: String) {
            body.append("--\(boundary)\(lineBreak)".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\(lineBreak)\(lineBreak)".data(using: .utf8)!)
            body.append("\(value)\(lineBreak)".data(using: .utf8)!)
        }

        appendField(name: "duration_seconds", value: String(duration))

        let trimmedTitle = meetingTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedTitle.isEmpty {
            appendField(name: "title", value: trimmedTitle)
        }

        body.append("--\(boundary)\(lineBreak)".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"audio\"; filename=\"meeting-recording.m4a\"\(lineBreak)".data(using: .utf8)!)
        body.append("Content-Type: audio/mp4\(lineBreak)\(lineBreak)".data(using: .utf8)!)
        body.append(fileData)
        body.append(lineBreak.data(using: .utf8)!)
        body.append("--\(boundary)--\(lineBreak)".data(using: .utf8)!)

        return body
    }

    private func validateResponse(data: Data, response: URLResponse, defaultMessage: String) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw UploadError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if let backendError = try? JSONDecoder().decode(BackendErrorResponse.self, from: data),
               let detail = backendError.detail {
                throw UploadError.backend(detail)
            }

            throw UploadError.backend("\(defaultMessage) Status \(httpResponse.statusCode).")
        }
    }
}

private struct BackendErrorResponse: Decodable {
    let detail: String?
}

private enum UploadError: LocalizedError {
    case invalidBackendURL
    case invalidResponse
    case backend(String)

    var errorDescription: String? {
        switch self {
        case .invalidBackendURL:
            return "Enter a valid backend URL before uploading."
        case .invalidResponse:
            return "The backend response was not valid HTTP."
        case let .backend(message):
            return message
        }
    }
}