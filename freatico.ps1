# Lee la base de datos de niveles freáticos (Excel de Documents\SIG\LECTURA NIVEL FREATICO) y deja un
# resumen liviano en JSON: pozos (número, coordenadas, hacienda, sector, zona) y lecturas por fecha.
# Lo usa servidor.ps1 (GET /api/freatico). El Excel pesa ~90 MB, por eso se lee por partes y sin abrir Excel.
#  - Hoja "BASE DE DATOS": formato ancho (una columna por fecha, 2020-2024)
#  - Hojas con encabezado No.Pozo / Latitud / Longitud / Fecha / ... / Lectura (Consolidado y hojas por fecha)
# Valores: número = profundidad (m); "SECO" = más de 2 m (se toma 2); "LLENO" = 0; 0, daños y notas = sin lectura.
param([string]$Archivo, [string]$Salida)

Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
Add-Type -ReferencedAssemblies System.Xml, System.IO.Compression, System.IO.Compression.FileSystem -TypeDefinition @'
using System; using System.IO; using System.IO.Compression; using System.Xml; using System.Linq;
using System.Collections.Generic; using System.Globalization; using System.Text;
public static class Freatico {
  static List<string> ss = new List<string>();
  static CultureInfo inv = CultureInfo.InvariantCulture;
  class Pozo { public string n; public double lat, lon; public string h = "", s = "", z = ""; }
  static SortedDictionary<string, Pozo> pozos = new SortedDictionary<string, Pozo>();
  static SortedDictionary<string, SortedDictionary<string, string>> lect = new SortedDictionary<string, SortedDictionary<string, string>>();

  static int Col(string r){ int c = 0; foreach (char ch in r) { if (ch >= 'A' && ch <= 'Z') c = c * 26 + (ch - 'A' + 1); else break; } return c; }
  static string Norm(string s){ if (s == null) return ""; var d = s.ToLowerInvariant().Normalize(NormalizationForm.FormD); var b = new StringBuilder(); foreach (var ch in d) if (char.IsLetterOrDigit(ch)) b.Append(ch); return b.ToString(); }
  static string Fecha(double serial){ return DateTime.FromOADate(serial).ToString("yyyy-MM-dd"); }
  static bool Num(string v, out double d){ return double.TryParse((v ?? "").Trim().Replace(',', '.'), NumberStyles.Float, inv, out d); }
  static string PozoId(string v){ double d; if (Num(v, out d) && d > 0 && d < 100000 && Math.Abs(d - Math.Round(d)) < 1e-9) return ((int)Math.Round(d)).ToString(); return null; }
  // Valor de lectura: número (m), "S" seco, o null si es una nota (dañado, no se encontró...)
  static string Valor(string v){
    if (v == null) return null; double d;
    // 0 exacto = celda sin lectura (las fórmulas del consolidado ponen 0); el agua en superficie se escribe "LLENO"
    if (Num(v, out d)) { if (d <= 0 || d > 5) return null; return Math.Round(d, 2).ToString(inv); }
    var n = Norm(v);
    if (n.StartsWith("seco")) return "S";
    if (n.StartsWith("lleno") || n.Contains("inund") || n.Contains("encharc")) return "0";
    return null;
  }
  // Recorre una hoja fila por fila; fila(n, celdas) devuelve false para detenerse
  static void Filas(ZipArchiveEntry e, Func<int, Dictionary<int, string>, bool> fila){
    using (var st = e.Open()) using (var xr = XmlReader.Create(st, new XmlReaderSettings { IgnoreWhitespace = true })) {
      Dictionary<int, string> cel = null; int col = 0, rn = 0; string t = null;
      while (xr.Read()) {
        if (xr.NodeType == XmlNodeType.Element) {
          if (xr.LocalName == "row") { cel = new Dictionary<int, string>(); int.TryParse(xr.GetAttribute("r"), out rn); if (xr.IsEmptyElement) { if (!fila(rn, cel)) return; } }
          else if (xr.LocalName == "c") { col = Col(xr.GetAttribute("r") ?? ""); t = xr.GetAttribute("t"); }
          else if (xr.LocalName == "v" && cel != null) { var v = xr.ReadElementContentAsString(); if (t == "s") { int i; if (int.TryParse(v, out i) && i < ss.Count) v = ss[i]; } if (t != "e") cel[col] = v; if (xr.NodeType == XmlNodeType.EndElement && xr.LocalName == "row") { if (!fila(rn, cel)) return; cel = null; } }
          else if (xr.LocalName == "t" && t == "inlineStr" && cel != null) { cel[col] = xr.ReadElementContentAsString(); }
        } else if (xr.NodeType == XmlNodeType.EndElement && xr.LocalName == "row" && cel != null) { if (!fila(rn, cel)) return; cel = null; }
      }
    }
  }
  static string G(Dictionary<int, string> c, int k){ string v; return k > 0 && c.TryGetValue(k, out v) ? v : null; }
  static void Poner(string id, string fecha, string val){
    if (id == null || val == null || !pozos.ContainsKey(id)) return;
    SortedDictionary<string, string> f; if (!lect.TryGetValue(fecha, out f)) lect[fecha] = f = new SortedDictionary<string, string>();
    f[id] = val;
  }
  static void PonerPozo(string id, string lat, string lon, string h, string s, string z){
    double la, lo; if (id == null || !Num(lat, out la) || !Num(lon, out lo) || la < 3 || la > 6 || lo > -75 || lo < -78) return;
    Pozo p; if (!pozos.TryGetValue(id, out p)) pozos[id] = p = new Pozo { n = id };
    p.lat = la; p.lon = lo; if (!string.IsNullOrWhiteSpace(h)) p.h = h.Trim(); if (!string.IsNullOrWhiteSpace(s)) p.s = s.Trim(); if (!string.IsNullOrWhiteSpace(z)) p.z = z.Trim();
  }

  // Formato ancho: fila de fechas encima del encabezado "No de piezometro"
  static void Ancha(ZipArchiveEntry e){
    Dictionary<int, string> fechas = new Dictionary<int, string>(), prev = null; int cId = 0, cLat = 0, cLon = 0, cH = 0, cS = 0, cZ = 0; bool listo = false; int vacias = 0;
    Filas(e, (rn, c) => {
      if (!listo) {
        foreach (var kv in c) { var n = Norm(kv.Value); if (n.StartsWith("nodepiez") || n.StartsWith("nopozo") || n == "pozo") cId = kv.Key; else if (n.StartsWith("latitud")) cLat = kv.Key; else if (n.StartsWith("longitud")) cLon = kv.Key; else if (n.StartsWith("hacienda")) cH = kv.Key; else if (n.StartsWith("sector")) cS = kv.Key; else if (n == "zona") cZ = kv.Key; }
        if (cId > 0 && cLat > 0 && prev != null) {
          foreach (var kv in prev) { double d; if (kv.Key > cLon && Num(kv.Value, out d) && d > 40000 && d < 60000) fechas[kv.Key] = Fecha(d); }
          listo = fechas.Count > 0; if (!listo) cId = 0;
        }
        prev = c; return rn < 60 || listo;
      }
      var id = PozoId(G(c, cId)); if (id == null) return ++vacias < 300; vacias = 0;
      PonerPozo(id, G(c, cLat), G(c, cLon), G(c, cH), G(c, cS), G(c, cZ));
      foreach (var kv in fechas) Poner(id, kv.Value, Valor(G(c, kv.Key)));
      return true;
    });
  }
  // Formato largo: una fila por pozo y fecha
  static int Larga(ZipArchiveEntry e){
    int cId = 0, cLat = 0, cLon = 0, cF = 0, cH = 0, cS = 0, cZ = 0, cL = 0, vacias = 0, n = 0;
    Filas(e, (rn, c) => {
      if (cL == 0) {
        int a = 0, b = 0, f = 0, l = 0;
        foreach (var kv in c) { var x = Norm(kv.Value); if (x.StartsWith("nopozo") || x.StartsWith("nodepiez") || x == "pozo") a = kv.Key; else if (x.StartsWith("latitud")) b = kv.Key; else if (x.StartsWith("longitud")) cLon = kv.Key; else if (x.StartsWith("fecha")) f = kv.Key; else if (x.StartsWith("lectura")) l = kv.Key; else if (x.StartsWith("hacienda")) cH = kv.Key; else if (x.StartsWith("sector")) cS = kv.Key; else if (x == "zona") cZ = kv.Key; }
        if (a > 0 && b > 0 && f > 0 && l > 0) { cId = a; cLat = b; cF = f; cL = l; }
        return rn < 30 || cL > 0;
      }
      var id = PozoId(G(c, cId)); double fd;
      if (id == null || !Num(G(c, cF), out fd) || fd < 40000 || fd > 60000) return ++vacias < 300;
      vacias = 0; n++;
      PonerPozo(id, G(c, cLat), G(c, cLon), G(c, cH), G(c, cS), G(c, cZ));
      Poner(id, Fecha(fd), Valor(G(c, cL)));
      return true;
    });
    return n;
  }
  static string Js(string s){ return "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"") + "\""; }

  public static string Leer(string ruta, string nombre, string fechaArchivo){
    ss.Clear(); pozos.Clear(); lect.Clear();
    using (var zip = ZipFile.OpenRead(ruta)) {
      var sse = zip.GetEntry("xl/sharedStrings.xml");
      if (sse != null) using (var st = sse.Open()) using (var xr = XmlReader.Create(st)) {
        StringBuilder sb = null;
        while (xr.Read()) {
          if (xr.NodeType == XmlNodeType.Element && xr.LocalName == "si") sb = new StringBuilder();
          else if (xr.NodeType == XmlNodeType.Element && xr.LocalName == "t" && sb != null) sb.Append(xr.ReadElementContentAsString());
          if (xr.NodeType == XmlNodeType.EndElement && xr.LocalName == "si") { ss.Add(sb.ToString()); sb = null; }
        }
      }
      var rels = new Dictionary<string, string>();
      var rx = new XmlDocument(); using (var st = zip.GetEntry("xl/_rels/workbook.xml.rels").Open()) rx.Load(st);
      foreach (XmlElement r in rx.GetElementsByTagName("Relationship")) { var tg = r.GetAttribute("Target"); rels[r.GetAttribute("Id")] = tg.StartsWith("/") ? tg.Substring(1) : "xl/" + tg; }
      var wb = new XmlDocument(); using (var st = zip.GetEntry("xl/workbook.xml").Open()) wb.Load(st);
      var hojas = new List<KeyValuePair<string, ZipArchiveEntry>>();
      foreach (XmlElement s in wb.GetElementsByTagName("sheet")) {
        string id = s.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships"), tg;
        if (rels.TryGetValue(id, out tg) && zip.GetEntry(tg) != null) hojas.Add(new KeyValuePair<string, ZipArchiveEntry>(s.GetAttribute("name"), zip.GetEntry(tg)));
      }
      // Primero el histórico ancho, luego las hojas por fecha y al final el Consolidado (manda si hay diferencias)
      foreach (var h in hojas) if (Norm(h.Key) == "basededatos") Ancha(h.Value);
      foreach (var h in hojas) { var n = Norm(h.Key); if (n != "basededatos" && n != "consolidado") Larga(h.Value); }
      foreach (var h in hojas) if (Norm(h.Key) == "consolidado") Larga(h.Value);
    }
    var o = new StringBuilder();
    o.Append("{\"archivo\":" + Js(nombre) + ",\"fechaArchivo\":" + Js(fechaArchivo) + ",\"pozos\":[");
    o.Append(string.Join(",", pozos.Values.OrderBy(p => int.Parse(p.n)).Select(p => "[" + p.n + "," + p.lat.ToString("0.0000000", inv) + "," + p.lon.ToString("0.0000000", inv) + "," + Js(p.h) + "," + Js(p.s) + "," + Js(p.z) + "]")));
    o.Append("],\"lecturas\":{");
    o.Append(string.Join(",", lect.Where(kv => kv.Value.Count >= 10).Select(kv => Js(kv.Key) + ":{" + string.Join(",", kv.Value.Select(x => Js(x.Key) + ":" + (x.Value == "S" ? "\"S\"" : x.Value))) + "}")));
    o.Append("}}");
    return o.ToString();
  }
}
'@

if (-not $Archivo) {
  $carpeta = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'SIG\LECTURA NIVEL FREATICO'
  $f = Get-ChildItem -Path $carpeta -Filter '*.xls*' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike '~$*' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $f) { Write-Error "No hay Excel en $carpeta"; exit 1 }
} else { $f = Get-Item $Archivo }
# Copia temporal por si el Excel está abierto
$tmp = [IO.Path]::GetTempFileName(); Copy-Item $f.FullName $tmp -Force
try { $json = [Freatico]::Leer($tmp, $f.Name, $f.LastWriteTime.ToString('s')) } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
if ($Salida) { [IO.File]::WriteAllText($Salida, $json, (New-Object System.Text.UTF8Encoding($false))) } else { $json }
