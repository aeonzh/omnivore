#if os(iOS)
  import Models
  import Services
  import SwiftUI
  import Views

  // swiftlint:disable line_length
  struct TextToSpeechView: View {
    @EnvironmentObject var audioController: AudioController

    var body: some View {
      Group {
        Form {
          Section(LocalText.texttospeechSettingsAudio) {
            Toggle(LocalText.texttospeechSettingsEnablePrefetch, isOn: $audioController.preloadEnabled)
          }
          NavigationLink(destination: TextToSpeechLanguageView().navigationTitle(LocalText.texttospeechLanguageDefault)) {
            Text(LocalText.texttospeechLanguageDefault)
          }
          innerBody
        }
      }.navigationTitle(LocalText.textToSpeechGeneric)
    }

    private var innerBody: some View {
      Section("Voices") {
        ForEach(Voices.Languages, id: \.key) { language in
          NavigationLink(destination: TextToSpeechVoiceSelectionView(forLanguage: language, showLanguageChanger: false)) {
            Text(language.name)
          }
        }
      }
    }
  }
#endif
