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

                        Text("Use a bearer token when backend auth is enabled, or leave it blank when local development sets DEV_AUTH_USER_ID.")
                            .foregroundStyle(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        Text("Backend URL")
                            .font(.headline)
                        TextField("http://localhost:8000", text: $viewModel.backendURL)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                            .textFieldStyle(.roundedBorder)

                        Text("Bearer token")
                            .font(.headline)
                        TextEditor(text: $viewModel.authToken)
                            .frame(minHeight: 100)
                            .padding(8)
                            .background(Color(uiColor: .secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))

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

private struct MeetingStartRequest: Encodable {
    let title: String?
}

@MainActor
final class RecordingViewModel: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published var backendURL = "http://localhost:8000"
    @Published var authToken = ""
    @Published var meetingTitle = ""
    @Published var statusMessage = "Ready to record."
    @Published var errorMessage = ""
    @Published var isRecording = false
    @Published var isUploading = false
    @Published var elapsedSeconds = 0
    @Published var recordingURL: URL?
    @Published var uploadResult: MeetingUploadResponse?

    private var audioRecorder: AVAudioRecorder?
    private var timer: Timer?
    private var recordingStartedAt: Date?

    var elapsedLabel: String {
        String(format: "%02d:%02d", elapsedSeconds / 60, elapsedSeconds % 60)
    }

    func prepareAudioSession() {
        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
            DispatchQueue.main.async {
                if !granted {
                    self?.errorMessage = "Microphone permission is required to record."
                }
            }
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
            recorder.delegate = self
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
            statusMessage = "Upload complete. Meeting created and finalized successfully."
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = "Upload failed."
        }

        isUploading = false
    }

    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if !flag {
            errorMessage = "Recording failed before completion."
            statusMessage = "Recording failed."
        }
    }

    private func startTimer() {
        stopTimer()
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            guard let self, let recordingStartedAt = self.recordingStartedAt else {
                return
            }

            self.elapsedSeconds = max(1, Int(Date().timeIntervalSince(recordingStartedAt).rounded()))
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func baseEndpoint() throws -> URL {
        let normalized = backendURL.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        guard let url = URL(string: normalized) else {
            throw UploadError.invalidBackendURL
        }

        return url
    }

    private func authorizedRequest(url: URL, method: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method

        let trimmedToken = authToken.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedToken.isEmpty {
            request.setValue("Bearer \(trimmedToken)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    private func startMeeting() async throws -> MeetingUploadResponse {
        let baseURL = try baseEndpoint()
        let startURL = baseURL.appendingPathComponent("meetings/start")
        var request = authorizedRequest(url: startURL, method: "POST")
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

        var request = authorizedRequest(url: uploadURL, method: "POST")
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

        let request = authorizedRequest(url: finalizeURL, method: "POST")
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