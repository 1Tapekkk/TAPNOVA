Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form = New-Object System.Windows.Forms.Form
$form.Text = 'TAPNOVA - haslo panelu Cloudflare'
$form.Size = New-Object System.Drawing.Size(510,255)
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$label = New-Object System.Windows.Forms.Label
$label.Text = "Wpisz haslo do panelu wlasciciela na Cloudflare i powtorz je.`nMozesz uzyc obecnego hasla. Zapisany zostanie tylko skrot."
$label.Location = New-Object System.Drawing.Point(20,18)
$label.Size = New-Object System.Drawing.Size(465,42)
$first = New-Object System.Windows.Forms.TextBox
$first.Location = New-Object System.Drawing.Point(20,70)
$first.Size = New-Object System.Drawing.Size(450,26)
$first.UseSystemPasswordChar = $true
$second = New-Object System.Windows.Forms.TextBox
$second.Location = New-Object System.Drawing.Point(20,108)
$second.Size = New-Object System.Drawing.Size(450,26)
$second.UseSystemPasswordChar = $true
$button = New-Object System.Windows.Forms.Button
$button.Text = 'Zapisz bezpieczny skrot'
$button.Location = New-Object System.Drawing.Point(235,157)
$button.Size = New-Object System.Drawing.Size(235,34)
$button.Add_Click({
  if ($first.Text.Length -lt 14 -or $first.Text -ne $second.Text) {
    [System.Windows.Forms.MessageBox]::Show('Haslo musi miec minimum 14 znakow. Oba pola musza byc takie same.') | Out-Null
    return
  }
  $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
  $form.Close()
})
$form.Controls.AddRange(@($label,$first,$second,$button))
$form.AcceptButton = $button
$form.Add_Shown({ $form.Show(); $form.Activate(); $first.Focus() })
if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { $form.Dispose(); exit 2 }
try {
  $saltBytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($saltBytes)
  $salt = [System.BitConverter]::ToString($saltBytes).Replace('-','').ToLowerInvariant()
  $derive = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($first.Text,[System.Text.Encoding]::UTF8.GetBytes($salt),600000,[System.Security.Cryptography.HashAlgorithmName]::SHA256)
  $proof = [System.BitConverter]::ToString($derive.GetBytes(32)).Replace('-','').ToLowerInvariant()
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $verifier = [System.BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($proof))).Replace('-','').ToLowerInvariant()
  @{ ADMIN_SALT=$salt; ADMIN_VERIFIER=$verifier } | ConvertTo-Json -Compress
} finally {
  $first.Clear(); $second.Clear(); $form.Dispose()
  if ($derive) { $derive.Dispose() }; if ($sha) { $sha.Dispose() }; if ($rng) { $rng.Dispose() }
}
