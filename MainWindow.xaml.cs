using Microsoft.Web.WebView2.Core;
using System.IO;
using System.Windows;
using System.Windows.Input;

namespace TapNova.Desktop;

public partial class MainWindow : Window
{
    private const string GameUrl = "https://moviestarplanet2.com/";
    private CoreWebView2Environment? _environment;
    private CoreWebView2BrowserExtension? _extension;
    private bool _ready;
    private bool _starting;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += MainWindow_Loaded;
        Browser.NavigationStarting += Browser_NavigationStarting;
        Browser.NavigationCompleted += Browser_NavigationCompleted;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        => await InitializeBrowserAsync();

    private async System.Threading.Tasks.Task InitializeBrowserAsync()
    {
        if (_starting) return;
        _starting = true;
        RetryButton.Visibility = Visibility.Collapsed;
        StartupProgress.Visibility = Visibility.Visible;
        try
        {
            // Keep the existing profile so the visual rebrand preserves local sessions.
            var userData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MSP2MultiToolV3", "WebView2");
            Directory.CreateDirectory(userData);

            var extensionPath = Path.Combine(AppContext.BaseDirectory, "Resources", "Extension");
            if (!File.Exists(Path.Combine(extensionPath, "manifest.json")))
                throw new FileNotFoundException("Nie znaleziono pliku rozszerzenia manifest.json.", extensionPath);

            StartupStatus.Text = "Przygotowywanie przeglądarki…";
            var options = new CoreWebView2EnvironmentOptions
            {
                AreBrowserExtensionsEnabled = true,
                EnableTrackingPrevention = true
            };

            _environment = await CoreWebView2Environment.CreateAsync(null, userData, options);
            await Browser.EnsureCoreWebView2Async(_environment);

            Browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            Browser.CoreWebView2.Settings.AreDevToolsEnabled = true;
            Browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
            Browser.CoreWebView2.Settings.IsPasswordAutosaveEnabled = false;
            Browser.CoreWebView2.Settings.IsGeneralAutofillEnabled = false;

            Browser.CoreWebView2.PermissionRequested += (_, args) =>
            {
                // Do not silently grant arbitrary permissions. MSP2's normal
                // web permissions remain controlled by WebView2 defaults.
                args.State = CoreWebView2PermissionState.Default;
            };

            StartupStatus.Text = "Ładowanie narzędzi TAPNOVA…";
            _extension = await Browser.CoreWebView2.Profile.AddBrowserExtensionAsync(extensionPath);
            // Unpacked extensions from different folders have different IDs. Retire
            // earlier copies so their document-start scripts cannot win the mount race.
            foreach (var installed in await Browser.CoreWebView2.Profile.GetBrowserExtensionsAsync())
            {
                if (installed.Id != _extension.Id && IsToolkitExtension(installed.Name))
                    await installed.EnableAsync(false);
            }
            await _extension.EnableAsync(true);

            StatusText.Text = $"Narzędzia gotowe · {_extension.Name}";
            StartupStatus.Text = "Otwieranie MovieStarPlanet 2…";
            Browser.Source = new Uri(GameUrl);
            _ready = true;
        }
        catch (Exception ex)
        {
            StartupStatus.Text = "Nie udało się uruchomić aplikacji. Spróbuj ponownie.";
            StartupProgress.Visibility = Visibility.Collapsed;
            RetryButton.Visibility = Visibility.Visible;
            StatusText.Text = ex.Message;
            MessageBox.Show(
                this,
                "Nie udało się uruchomić TAPNOVA.\n\n" + ex.Message,
                "TAPNOVA",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
        finally { _starting = false; }
    }

    private static bool IsToolkitExtension(string name) =>
        name.Equals("TAPNOVA", StringComparison.OrdinalIgnoreCase) ||
        name.Equals("6x0k Space", StringComparison.OrdinalIgnoreCase) ||
        name.Equals("MSP2TOOL", StringComparison.OrdinalIgnoreCase);

    private async void Retry_Click(object sender, RoutedEventArgs e)
    {
        if (!_ready) { await InitializeBrowserAsync(); return; }
        RetryButton.Visibility = Visibility.Collapsed;
        StartupProgress.Visibility = Visibility.Visible;
        StartupStatus.Text = "Ponowne otwieranie MovieStarPlanet 2…";
        Browser.Source = new Uri(GameUrl);
        Browser.Reload();
    }

    private void Browser_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        StatusText.Text = "Ładowanie: " + e.Uri;
    }

    private void Browser_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (e.IsSuccess)
        {
            AddressBox.Text = Browser.Source?.ToString() ?? GameUrl;
            StatusText.Text = "Gotowe · " + (Browser.CoreWebView2.DocumentTitle ?? "MSP2");
            StartupOverlay.Visibility = Visibility.Collapsed;
            Browser.Visibility = Visibility.Visible;
        }
        else
        {
            StatusText.Text = $"Nie udało się wczytać strony: {e.WebErrorStatus}";
            if (StartupOverlay.Visibility == Visibility.Visible)
            {
                StartupStatus.Text = "Nie udało się wczytać gry. Sprawdź połączenie i spróbuj ponownie.";
                StartupProgress.Visibility = Visibility.Collapsed;
                RetryButton.Visibility = Visibility.Visible;
            }
        }
    }

    private void Back_Click(object sender, RoutedEventArgs e)
    {
        if (_ready && Browser.CanGoBack) Browser.GoBack();
    }

    private void Forward_Click(object sender, RoutedEventArgs e)
    {
        if (_ready && Browser.CanGoForward) Browser.GoForward();
    }

    private void Refresh_Click(object sender, RoutedEventArgs e)
    {
        if (_ready) Browser.Reload();
    }

    private void OpenGame_Click(object sender, RoutedEventArgs e)
    {
        if (!_ready) return;
        Browser.Source = new Uri(GameUrl);
    }

    private void Go_Click(object sender, RoutedEventArgs e) => NavigateAddress();

    private void AddressBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter) NavigateAddress();
    }

    private void NavigateAddress()
    {
        if (!_ready) return;
        var raw = AddressBox.Text.Trim();
        if (string.IsNullOrWhiteSpace(raw)) return;
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            raw = "https://" + raw;
            if (!Uri.TryCreate(raw, UriKind.Absolute, out uri)) return;
        }
        Browser.Source = uri;
    }

    private async void ClearData_Click(object sender, RoutedEventArgs e)
    {
        if (!_ready) return;
        var result = MessageBox.Show(
            this,
            "Usunąć ciasteczka, pamięć podręczną i dane stron zapisane w TAPNOVA?\n\nTa operacja wyloguje Cię z gry.",
            "Wyczyść dane · TAPNOVA",
            MessageBoxButton.YesNo,
            MessageBoxImage.Warning);
        if (result != MessageBoxResult.Yes) return;

        try
        {
            await Browser.CoreWebView2.Profile.ClearBrowsingDataAsync();
            StatusText.Text = "Dane przeglądarki usunięte. Ponowne ładowanie MSP2…";
            Browser.Reload();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "Wyczyść dane · TAPNOVA", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    protected override void OnClosed(EventArgs e)
    {
        try { Browser.Dispose(); } catch { }
        base.OnClosed(e);
    }
}
